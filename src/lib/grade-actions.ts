'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAssignmentCourseId } from '@/lib/course-scope'

export async function saveAnswerKey(
  assignmentId: string,
  url: string | null,
  courseId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Allow instructors/admins globally, or TAs for this course
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()

  // Verify the assignment belongs to this course to prevent cross-course mutation
  const { data: owned } = await admin
    .from('assignments')
    .select('module_days!module_day_id(modules(course_id))')
    .eq('id', assignmentId)
    .single()
  const assignmentCourseId = (() => {
    const md = Array.isArray(owned?.module_days) ? owned.module_days[0] : owned?.module_days
    const mod = Array.isArray(md?.modules) ? md.modules[0] : md?.modules
    return mod?.course_id
  })()
  if (assignmentCourseId !== courseId) return { error: 'Not authorized' }

  const { error } = await admin.from('assignments').update({ answer_key_url: url }).eq('id', assignmentId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

export async function markCompleteNoSubmission(
  assignmentId: string,
  studentId: string,
  grade: 'complete' | null,
  courseId?: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    if (!courseId) return { error: 'Not authorized' }
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()

  if (courseId) {
    const actualCourseId = await getAssignmentCourseId(admin, assignmentId)
    if (actualCourseId !== courseId) return { error: 'Not authorized' }
  }

  // Upsert placeholder submission
  const { data: existing } = await admin
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()

  let submissionId: string
  if (existing) {
    submissionId = existing.id
  } else {
    const { data: created, error: createError } = await admin
      .from('submissions')
      .insert({ assignment_id: assignmentId, student_id: studentId, submission_type: 'text', content: null, status: 'submitted' })
      .select('id')
      .single()
    if (createError || !created) return { error: createError?.message ?? 'Failed to create submission' }
    submissionId = created.id
  }

  const now = grade ? new Date().toISOString() : null
  const { error } = await admin
    .from('submissions')
    .update({ grade, status: grade ? 'graded' : 'submitted', graded_at: now, graded_by: grade ? user.id : null })
    .eq('id', submissionId)

  if (error) return { error: error.message }

  if (grade) {
    await admin.from('grade_history').insert({ submission_id: submissionId, grade, graded_at: now })

    // Notify student
    if (courseId) {
      const { data: asgn } = await admin
        .from('assignments')
        .select('title')
        .eq('id', assignmentId)
        .single()
      if (asgn) {
        await admin.from('notifications').insert({
          user_id: studentId,
          type: 'grade_posted',
          course_id: courseId,
          assignment_id: assignmentId,
          message: `Your "${asgn.title}" submission was marked ${grade}.`,
        })
      }
    }
  }

  if (courseId) {
    revalidatePath(`/instructor/courses/${courseId}`)
    revalidatePath(`/instructor/courses/${courseId}/gradebook`)
    revalidatePath(`/student/courses/${courseId}`, 'layout')
  } else {
    revalidatePath('/instructor/courses', 'layout')
    revalidatePath('/student/courses', 'layout')
  }
  return {}
}

export async function saveGrade(
  submissionId: string,
  grade: 'complete' | 'incomplete' | null,
  courseId?: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    if (!courseId) return { error: 'Not authorized' }
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()

  // Fetch current grade + assignment to prevent duplicate history entries and to
  // verify the submission actually belongs to the passed courseId (a TA scoped to
  // one course must not be able to grade a submission from a different course).
  const { data: current } = await admin
    .from('submissions')
    .select('grade, student_id, assignment_id')
    .eq('id', submissionId)
    .single()

  if (!current) return { error: 'Submission not found' }

  const assignmentCourseId = await getAssignmentCourseId(admin, current.assignment_id)
  if (courseId && assignmentCourseId !== courseId) return { error: 'Not authorized' }

  if (current.grade === grade) return {}

  const now = grade ? new Date().toISOString() : null
  const { error } = await admin
    .from('submissions')
    .update({
      grade,
      status: grade ? 'graded' : 'submitted',
      graded_at: now,
      graded_by: grade ? user.id : null,
    })
    .eq('id', submissionId)

  if (error) return { error: error.message }

  if (grade) {
    await admin.from('grade_history').insert({ submission_id: submissionId, grade, graded_at: now })

    // Notify student
    if (assignmentCourseId) {
      const { data: asgn } = await admin
        .from('assignments')
        .select('title')
        .eq('id', current.assignment_id)
        .single()
      if (asgn) {
        await admin.from('notifications').insert({
          user_id: current.student_id,
          type: 'grade_posted',
          course_id: assignmentCourseId,
          assignment_id: current.assignment_id,
          message: `Your "${asgn.title}" submission was marked ${grade}.`,
        })
      }
    }
  }

  if (courseId) {
    revalidatePath(`/instructor/courses/${courseId}`)
    revalidatePath(`/student/courses/${courseId}`, 'layout')
  } else {
    revalidatePath('/instructor/courses', 'layout')
    revalidatePath('/student/courses', 'layout')
  }

  return {}
}

// Toggle a checklist response for a submission (instructors, TAs only)
export async function toggleChecklistResponse(
  submissionId: string,
  checklistItemId: string,
  checked: boolean,
  courseId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()

  const { data: sub } = await admin.from('submissions').select('assignment_id').eq('id', submissionId).single()
  if (!sub) return { error: 'Submission not found' }
  const assignmentCourseId = await getAssignmentCourseId(admin, sub.assignment_id)
  if (assignmentCourseId !== courseId) return { error: 'Not authorized' }

  const { error } = await admin
    .from('checklist_responses')
    .upsert(
      { submission_id: submissionId, checklist_item_id: checklistItemId, checked, graded_by: user.id },
      { onConflict: 'submission_id,checklist_item_id' }
    )

  if (error) return { error: error.message }
  return {}
}

// Add a threaded comment to a submission.
// Instructors/admins can comment on any submission.
// Students can only comment on their own submission.
// TAs must be enrolled in the course the submission belongs to.
export async function addSubmissionComment(
  submissionId: string,
  content: string,
  courseId?: string,
): Promise<{ id: string; created_at: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const admin = createServiceSupabaseClient()

  const { data: submission } = await admin
    .from('submissions')
    .select('student_id, assignment_id')
    .eq('id', submissionId)
    .single()

  if (!submission) return { error: 'Not found' }

  const assignmentCourseId = await getAssignmentCourseId(admin, submission.assignment_id)

  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    if (submission.student_id !== user.id) {
      // Not the submission owner — must be a TA for this course, and the
      // submission must actually belong to that course (not just the TA's own).
      if (!courseId || assignmentCourseId !== courseId) return { error: 'Not authorized' }

      const { data: enr } = await supabase.from('course_enrollments')
        .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
      if (enr?.role !== 'ta') return { error: 'Not authorized' }
    }
  }

  const { data, error } = await admin
    .from('submission_comments')
    .insert({ submission_id: submissionId, author_id: user.id, content: content.trim() })
    .select('id, created_at')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to save' }

  // Notify student when an instructor or TA comments (not when the student comments on their own)
  if (submission.student_id !== user.id && assignmentCourseId) {
    const { data: asgn } = await admin
      .from('assignments')
      .select('title')
      .eq('id', submission.assignment_id)
      .single()
    if (asgn) {
      await admin.from('notifications').insert({
        user_id: submission.student_id,
        type: 'submission_comment',
        course_id: assignmentCourseId,
        assignment_id: submission.assignment_id,
        message: `Your instructor left a comment on your "${asgn.title}" submission.`,
      })
    }
  }

  return { id: data.id, created_at: data.created_at }
}

export type SubmissionCommentPreview = {
  id: string
  content: string
  created_at: string
  author_id: string
  author_name: string
  author_role: string
}

// Instructor/staff/admin (or TA scoped to the course) preview of a submission's comment thread.
export async function getSubmissionComments(
  submissionId: string,
  courseId: string,
): Promise<SubmissionCommentPreview[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return []
  }

  const admin = createServiceSupabaseClient()

  // Verify the submission's assignment actually belongs to this course
  const { data: submission } = await admin
    .from('submissions')
    .select('assignment_id')
    .eq('id', submissionId)
    .single()
  if (!submission) return []

  const { data: owned } = await admin
    .from('assignments')
    .select('module_days!module_day_id(modules(course_id))')
    .eq('id', submission.assignment_id)
    .single()
  const assignmentCourseId = (() => {
    const md = Array.isArray(owned?.module_days) ? owned.module_days[0] : owned?.module_days
    const mod = Array.isArray(md?.modules) ? md.modules[0] : md?.modules
    return mod?.course_id
  })()
  if (assignmentCourseId !== courseId) return []

  const { data: rawComments } = await admin
    .from('submission_comments')
    .select('id, content, created_at, author_id, users(name, role)')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })

  return (rawComments ?? []).map(c => {
    const u = Array.isArray(c.users) ? c.users[0] : c.users
    return {
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      author_id: c.author_id,
      author_name: (u as { name: string; role: string } | null)?.name ?? 'Unknown',
      author_role: (u as { name: string; role: string } | null)?.role ?? 'instructor',
    }
  })
}

// Edit a comment — only the original author may edit their own comment.
export async function editSubmissionComment(
  commentId: string,
  content: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('submission_comments')
    .update({ content: content.trim() })
    .eq('id', commentId)
    .eq('author_id', user.id)

  if (error) return { error: error.message }
  return {}
}

// Delete a comment — authors can delete their own; instructors/admins can delete any.
export async function deleteSubmissionComment(
  commentId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isStaff = profile?.role === 'instructor' || profile?.role === 'staff' || profile?.role === 'admin'

  const admin = createServiceSupabaseClient()
  const query = admin.from('submission_comments').delete().eq('id', commentId)
  const { error } = await (isStaff ? query : query.eq('author_id', user.id))

  if (error) return { error: error.message }
  return {}
}

// Student saves a comment on their own submission — scoped to auth.uid()
export async function saveStudentComment(
  submissionId: string,
  comment: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // RLS + explicit student_id filter ensures students can only update their own submissions
  const { error } = await supabase
    .from('submissions')
    .update({ student_comment: comment.trim() || null })
    .eq('id', submissionId)
    .eq('student_id', user.id)

  if (error) return { error: error.message }
  return {}
}

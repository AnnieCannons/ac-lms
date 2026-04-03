'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

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
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()
  const { error } = await admin.from('assignments').update({ answer_key_url: url }).eq('id', assignmentId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

export async function markCompleteNoSubmission(
  assignmentId: string,
  studentId: string,
  grade: 'complete' | null,
  gradedById: string,
  courseId?: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    if (!courseId) return { error: 'Not authorized' }
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()

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
    .update({ grade, status: grade ? 'graded' : 'submitted', graded_at: now, graded_by: grade ? gradedById : null })
    .eq('id', submissionId)

  if (error) return { error: error.message }

  if (grade) {
    await admin.from('grade_history').insert({ submission_id: submissionId, grade, graded_at: now })
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

export async function saveGrade(
  submissionId: string,
  grade: 'complete' | 'incomplete' | null,
  gradedById: string,
  courseId?: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    if (!courseId) return { error: 'Not authorized' }
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()

  // Fetch current grade to prevent duplicate history entries
  const { data: current } = await admin
    .from('submissions')
    .select('grade')
    .eq('id', submissionId)
    .single()

  if (current?.grade === grade) return {}

  const now = grade ? new Date().toISOString() : null
  const { error } = await admin
    .from('submissions')
    .update({
      grade,
      status: grade ? 'graded' : 'submitted',
      graded_at: now,
      graded_by: grade ? gradedById : null,
    })
    .eq('id', submissionId)

  if (error) return { error: error.message }

  if (grade) {
    await admin.from('grade_history').insert({ submission_id: submissionId, grade, graded_at: now })
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
  gradedById: string,
  courseId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    const { data: enr } = await supabase.from('course_enrollments')
      .select('role').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
    if (enr?.role !== 'ta') return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('checklist_responses')
    .upsert(
      { submission_id: submissionId, checklist_item_id: checklistItemId, checked, graded_by: gradedById },
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

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    // Look up the submission to verify ownership or TA access
    const { data: submission } = await admin
      .from('submissions')
      .select('student_id')
      .eq('id', submissionId)
      .single()

    if (!submission) return { error: 'Not found' }

    if (submission.student_id !== user.id) {
      // Not the submission owner — must be a TA for this course
      const resolvedCourseId = courseId
      if (!resolvedCourseId) return { error: 'Not authorized' }

      const { data: enr } = await supabase.from('course_enrollments')
        .select('role').eq('user_id', user.id).eq('course_id', resolvedCourseId).maybeSingle()
      if (enr?.role !== 'ta') return { error: 'Not authorized' }
    }
  }

  const { data, error } = await admin
    .from('submission_comments')
    .insert({ submission_id: submissionId, author_id: user.id, content: content.trim() })
    .select('id, created_at')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to save' }
  return { id: data.id, created_at: data.created_at }
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
  const isStaff = profile?.role === 'instructor' || profile?.role === 'admin'

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

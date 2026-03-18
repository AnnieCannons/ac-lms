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
  if (courseId) revalidatePath(`/instructor/courses/${courseId}`)
  else revalidatePath('/instructor/courses', 'layout')
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

  if (courseId) revalidatePath(`/instructor/courses/${courseId}`)
  else revalidatePath('/instructor/courses', 'layout')

  return {}
}

// Toggle a checklist response for a submission (instructors, TAs)
export async function toggleChecklistResponse(
  submissionId: string,
  checklistItemId: string,
  checked: boolean,
  gradedById: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

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

// Add a threaded comment to a submission (students, instructors, TAs)
export async function addSubmissionComment(
  submissionId: string,
  content: string,
): Promise<{ id: string; created_at: string } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  const { data, error } = await admin
    .from('submission_comments')
    .insert({ submission_id: submissionId, author_id: user.id, content: content.trim() })
    .select('id, created_at')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to save' }
  return { id: data.id, created_at: data.created_at }
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

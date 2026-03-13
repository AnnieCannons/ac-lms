'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

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

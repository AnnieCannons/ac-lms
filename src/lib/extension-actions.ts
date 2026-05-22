'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export type ExtensionRequest = {
  id: string
  assignment_id: string
  student_id: string
  course_id: string
  reason: string
  reason_other: string | null
  plan: string[]
  plan_other: string | null
  requested_due_date: string
  notes: string | null
  status: 'pending' | 'approved' | 'denied'
  instructor_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  // joined
  student_name?: string
  assignment_title?: string
}

async function getAuthedStudent() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role, name').eq('id', user.id).single()
  if (profile?.role !== 'student') return { error: 'Not authorized' as const }
  return { user, profile }
}

async function getAuthedInstructorOrTa(courseId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()

  const isInstructorOrAdmin = profile?.role === 'instructor' || profile?.role === 'staff' || profile?.role === 'admin'
  if (!isInstructorOrAdmin) {
    const { data: taEnrollment } = await supabase
      .from('course_enrollments')
      .select('role')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('role', 'ta')
      .maybeSingle()
    if (!taEnrollment) return { error: 'Not authorized' as const }
  }

  const admin = createServiceSupabaseClient()
  return { user, admin }
}

export async function submitExtensionRequest(
  assignmentId: string,
  courseId: string,
  reason: string,
  reasonOther: string | null,
  plan: string[],
  planOther: string | null,
  requestedDueDate: string,
  notes: string | null
): Promise<{ id?: string; error?: string }> {
  const auth = await getAuthedStudent()
  if ('error' in auth) return { error: auth.error }
  const { user, profile } = auth

  const supabase = await createServerSupabaseClient()

  // Verify enrollment in this course
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .in('role', ['student'])
    .maybeSingle()
  if (!enrollment) return { error: 'Not enrolled in this course' }

  // Check no existing request for this assignment
  const { data: existing } = await supabase
    .from('extension_requests')
    .select('id, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .maybeSingle()
  if (existing) return { error: 'You already have an extension request for this assignment' }

  const { data, error } = await supabase
    .from('extension_requests')
    .insert({
      assignment_id: assignmentId,
      student_id: user.id,
      course_id: courseId,
      reason,
      reason_other: reasonOther,
      plan,
      plan_other: planOther,
      requested_due_date: requestedDueDate,
      notes,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Fetch assignment title for notification
  const { data: assignment } = await supabase
    .from('assignments')
    .select('title')
    .eq('id', assignmentId)
    .single()

  // Notify all instructors/TAs enrolled in this course
  const admin = createServiceSupabaseClient()
  const { data: instructors } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .in('role', ['instructor', 'admin', 'ta'])

  if (instructors && instructors.length > 0) {
    await admin.from('notifications').insert(
      instructors.map(({ user_id }) => ({
        user_id,
        type: 'extension_request',
        course_id: courseId,
        assignment_id: assignmentId,
        extension_request_id: data.id,
        message: `${profile.name} requested an extension for "${assignment?.title ?? 'an assignment'}"`,
      }))
    )
  }

  revalidatePath(`/student/courses/${courseId}/assignments/${assignmentId}`)
  return { id: data.id }
}

export async function cancelExtensionRequest(
  requestId: string,
  courseId: string,
  assignmentId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedStudent()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('extension_requests')
    .delete()
    .eq('id', requestId)
    .eq('student_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  revalidatePath(`/student/courses/${courseId}/assignments/${assignmentId}`)
  revalidatePath(`/instructor/courses/${courseId}/extension-requests`)
  return {}
}

export async function reviewExtensionRequest(
  requestId: string,
  courseId: string,
  status: 'approved' | 'denied',
  instructorComment: string | null
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructorOrTa(courseId)
  if ('error' in auth) return { error: auth.error }
  const { user, admin } = auth

  // Fetch the request
  const { data: req } = await admin
    .from('extension_requests')
    .select('id, assignment_id, student_id, requested_due_date, status')
    .eq('id', requestId)
    .eq('course_id', courseId)
    .single()

  if (!req) return { error: 'Request not found' }
  if (req.status !== 'pending') return { error: 'Request has already been reviewed' }

  // Fetch assignment title for notification
  const { data: assignment } = await admin
    .from('assignments')
    .select('title')
    .eq('id', req.assignment_id)
    .single()

  // Update the request
  const { error: updateError } = await admin
    .from('extension_requests')
    .update({
      status,
      instructor_comment: instructorComment,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) return { error: updateError.message }

  // If approved, create the assignment override directly with service role
  if (status === 'approved') {
    const { error: overrideError } = await admin
      .from('assignment_overrides')
      .upsert(
        { assignment_id: req.assignment_id, student_id: req.student_id, due_date: req.requested_due_date, excused: false },
        { onConflict: 'assignment_id,student_id' }
      )
    if (overrideError) return { error: overrideError.message }
  }

  // Notify the student
  const approvedMessage = `Your extension request for "${assignment?.title ?? 'an assignment'}" was approved. Your new due date is ${new Date(req.requested_due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}.`
  const deniedMessage = `Your request for an extension on "${assignment?.title ?? 'an assignment'}" cannot be accommodated at this time. Please reach out to your instructor if you have further questions.`

  await admin.from('notifications').insert({
    user_id: req.student_id,
    type: status === 'approved' ? 'extension_approved' : 'extension_denied',
    course_id: courseId,
    assignment_id: req.assignment_id,
    extension_request_id: requestId,
    message: status === 'approved' ? approvedMessage : deniedMessage,
  })

  revalidatePath(`/instructor/courses/${courseId}/extension-requests`)
  revalidatePath(`/student/courses/${courseId}/assignments/${req.assignment_id}`)
  return {}
}

export async function getExtensionRequestForStudent(
  assignmentId: string,
  studentId: string
): Promise<ExtensionRequest | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isStaff = profile?.role === 'instructor' || profile?.role === 'staff' || profile?.role === 'admin'
  if (!isStaff && user.id !== studentId) return null

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('extension_requests')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  return data ?? null
}

export async function getCourseExtensionRequests(
  courseId: string
): Promise<ExtensionRequest[]> {
  const auth = await getAuthedInstructorOrTa(courseId)
  if ('error' in auth) return []

  const { data } = await auth.admin
    .from('extension_requests')
    .select(`
      *,
      users!extension_requests_student_id_fkey(name),
      assignments!extension_requests_assignment_id_fkey(title)
    `)
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    student_name: (r.users as { name: string } | null)?.name ?? 'Unknown',
    assignment_title: (r.assignments as { title: string } | null)?.title ?? 'Unknown',
  })) as ExtensionRequest[]
}

export async function getPendingExtensionCount(courseId: string): Promise<number> {
  const auth = await getAuthedInstructorOrTa(courseId)
  if ('error' in auth) return 0

  const { count } = await auth.admin
    .from('extension_requests')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('status', 'pending')
  return count ?? 0
}

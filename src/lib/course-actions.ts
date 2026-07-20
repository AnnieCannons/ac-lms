'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { notifyByEmail } from '@/lib/slack'

export async function createCourse(params: {
  name: string
  code: string
  startDate: string | null
  endDate: string | null
  syllabusContent: string | null
  paidLearners: boolean
  instructorIds?: string[]
}): Promise<{ courseId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()
  const { data: course, error: courseError } = await admin
    .from('courses')
    .insert({
      name: params.name,
      code: params.code,
      start_date: params.startDate,
      end_date: params.endDate,
      syllabus_content: params.syllabusContent,
      paid_learners: params.paidLearners,
    })
    .select('id')
    .single()
  if (courseError || !course) return { error: courseError?.message ?? 'Failed to create course' }

  // Enroll the creator plus any additionally-assigned instructors — done with the
  // service-role client so it can never be silently blocked by RLS the way the old
  // client-side insert was.
  const instructorIds = new Set([user.id, ...(params.instructorIds ?? [])])
  const { error: enrollError } = await admin
    .from('course_enrollments')
    .insert(Array.from(instructorIds, id => ({ user_id: id, course_id: course.id, role: 'instructor' })))
  if (enrollError) return { error: `Course created, but failed to enroll instructors: ${enrollError.message}. Contact an admin.` }

  // Notify anyone the creator assigned besides themselves — they didn't ask to be
  // added to this course, so a Slack DM lets them know it happened.
  const notifyIds = [...instructorIds].filter(id => id !== user.id)
  if (notifyIds.length > 0) {
    const { data: creatorProfile } = await admin.from('users').select('name, email').eq('id', user.id).single()
    const creatorName = creatorProfile?.name ?? creatorProfile?.email ?? 'Someone'
    const { data: notifyUsers } = await admin.from('users').select('email').in('id', notifyIds)
    await Promise.all(
      (notifyUsers ?? [])
        .filter((u): u is { email: string } => !!u.email)
        .map(u => notifyByEmail(u.email, `${creatorName} added you as an instructor on *${params.name}* (${params.code}).`))
    )
  }

  return { courseId: course.id }
}

export async function updateCourseDates(
  courseId: string,
  startDate: string | null,
  endDate: string | null,
  airtableCourseName: string | null = null,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  // Admins can edit any course; instructors must be enrolled in the course
  if (profile?.role !== 'admin') {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('role')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()
    if (enrollment?.role !== 'instructor') return { error: 'Not authorized' }
  }

  const update: Record<string, unknown> = { start_date: startDate || null, end_date: endDate || null }
  if (airtableCourseName !== null) update.airtable_course_name = airtableCourseName || null

  const { error } = await supabase
    .from('courses')
    .update(update)
    .eq('id', courseId)

  if (error) return { error: error.message }
  return {}
}

export async function archiveCourse(
  courseId: string,
  archived: boolean,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  if (profile?.role !== 'admin') {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('role')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()
    if (enrollment?.role !== 'instructor') return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('courses')
    .update({ archived })
    .eq('id', courseId)

  if (error) return { error: error.message }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/instructor/courses')
  return {}
}

'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { notifyByEmail } from '@/lib/slack'
import { validReadinessChannel } from '@/lib/readiness-channels'

/** Keeps only ids of real instructor/staff/admin users, for courses.readiness_instructor_ids. */
async function validStaffIds(admin: ReturnType<typeof createServiceSupabaseClient>, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return []
  const { data } = await admin
    .from('users')
    .select('id')
    .in('id', unique)
    .in('role', ['instructor', 'staff', 'admin'])
  return (data ?? []).map(u => u.id as string)
}

export async function createCourse(params: {
  name: string
  code: string
  startDate: string | null
  endDate: string | null
  syllabusContent: string | null
  paidLearners: boolean
  instructorIds?: string[]
  readinessInstructorIds?: string[]
  readinessSlackChannel?: string | null
}): Promise<{ courseId?: string; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  const admin = createServiceSupabaseClient()
  const readinessInstructorIds = await validStaffIds(admin, params.readinessInstructorIds ?? [])
  const { data: course, error: courseError } = await admin
    .from('courses')
    .insert({
      name: params.name,
      code: params.code,
      start_date: params.startDate,
      end_date: params.endDate,
      syllabus_content: params.syllabusContent,
      paid_learners: params.paidLearners,
      readiness_instructor_ids: readinessInstructorIds,
      readiness_slack_channel: validReadinessChannel(params.readinessSlackChannel),
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
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
    const courseUrl = `${appUrl}/instructor/courses/${course.id}`
    await Promise.all(
      (notifyUsers ?? [])
        .filter((u): u is { email: string } => !!u.email)
        .map(u => notifyByEmail(u.email, `${creatorName} added you as an instructor on *${params.name}* (${params.code}).\n${courseUrl}`))
    )
  }

  return { courseId: course.id }
}

export async function updateCourseDates(
  courseId: string,
  startDate: string | null,
  endDate: string | null,
  airtableCourseName: string | null = null,
  readinessEnabled: boolean | null = null,
  readinessInstructorIds: string[] | null = null,
  readinessSlackChannel: string | null | undefined = undefined,
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

  if (readinessEnabled !== null) {
    const effectiveAirtableName = airtableCourseName !== null ? airtableCourseName : (
      (await supabase.from('courses').select('airtable_course_name').eq('id', courseId).single()).data?.airtable_course_name ?? null
    )
    if (readinessEnabled && !effectiveAirtableName) {
      return { error: 'Set an Airtable Course Name before enabling the weekly readiness score.' }
    }
    update.readiness_enabled = readinessEnabled
  }

  if (readinessInstructorIds !== null) {
    update.readiness_instructor_ids = await validStaffIds(createServiceSupabaseClient(), readinessInstructorIds)
  }

  if (readinessSlackChannel !== undefined) update.readiness_slack_channel = validReadinessChannel(readinessSlackChannel)

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

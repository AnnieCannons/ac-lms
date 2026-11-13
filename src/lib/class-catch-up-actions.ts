'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isCourseAccessError, requireCourseInstructorAccess } from '@/lib/course-access'
import { notifyByEmail, notifyStaff } from '@/lib/slack'
import { instructorFollowUpMessage, isDateParam, validateCatchUpInput, type CatchUpInput } from '@/lib/class-catch-up'

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com').replace(/\/$/, '')

/**
 * A student submits the Class Catch Up Form for a course they're enrolled in as a student.
 * Every instructor enrolled in that course gets a Slack DM to follow up (staff notify
 * address if the course has none, so it's never dropped).
 */
export async function submitCatchUpForm(
  courseId: string,
  input: CatchUpInput,
  absenceDate?: string | null,
): Promise<{ ok: true; instructorsNotified: number } | { error: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }

  const checked = validateCatchUpInput(input)
  if ('error' in checked) return checked

  // The service client is used only after confirming the caller is a student in this course.
  const admin = createServiceSupabaseClient()
  const { data: enrollment } = await admin
    .from('course_enrollments')
    .select('role')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('role', 'student')
    .maybeSingle()
  if (!enrollment) return { error: 'Only students in this course can submit the catch-up form.' }

  const { value } = checked
  const { data: form, error } = await admin
    .from('class_catch_up_forms')
    .insert({
      student_id: user.id,
      course_id: courseId,
      absence_date: isDateParam(absenceDate) ? absenceDate : null,
      missed_blocks: value.missedBlocks,
      lectures_missed: value.lecturesMissed,
      lecture_links: value.lectureLinks,
      assignments_missed: value.assignmentsMissed,
      makeup_plan: value.makeupPlan,
      notes: value.notes,
    })
    .select('id')
    .single()
  if (error || !form) {
    console.error('submitCatchUpForm insert failed', error)
    return { error: 'Could not save your form. Please try again.' }
  }

  const [{ data: student }, { data: course }, { data: instructorRows }] = await Promise.all([
    admin.from('users').select('name, email').eq('id', user.id).maybeSingle(),
    admin.from('courses').select('name').eq('id', courseId).maybeSingle(),
    admin.from('course_enrollments').select('users(email)').eq('course_id', courseId).eq('role', 'instructor'),
  ])
  const message = instructorFollowUpMessage(
    student?.name || student?.email || 'A student',
    course?.name ?? 'their course',
    value,
    `${appUrl()}/instructor/courses/${courseId}/catch-up`,
  )
  type InstructorRow = { users: { email: string | null } | null }
  const emails = [...new Set(((instructorRows ?? []) as unknown as InstructorRow[])
    .map(r => r.users?.email)
    .filter((e): e is string => !!e))]

  let notified = 0
  if (emails.length) {
    const results = await Promise.all(emails.map(e => notifyByEmail(e, message).catch(() => false)))
    notified = results.filter(Boolean).length
  } else {
    await notifyStaff(`(No instructor is enrolled in this course.)\n${message}`).catch(() => undefined)
  }
  if (notified) await admin.from('class_catch_up_forms').update({ instructors_notified: notified }).eq('id', form.id)

  revalidatePath(`/student/courses/${courseId}/catch-up`)
  revalidatePath(`/instructor/courses/${courseId}/catch-up`)
  return { ok: true, instructorsNotified: notified }
}

/** Instructors, staff, admins and the course's TAs tick off that they've followed up. */
export async function setCatchUpFollowedUp(formId: string, done: boolean): Promise<{ ok: true } | { error: string }> {
  const admin = createServiceSupabaseClient()
  const { data: form } = await admin.from('class_catch_up_forms').select('id, course_id').eq('id', formId).maybeSingle()
  if (!form) return { error: 'Form not found.' }

  const access = await requireCourseInstructorAccess(form.course_id)
  if (isCourseAccessError(access)) return { error: access.error }

  const { error } = await admin
    .from('class_catch_up_forms')
    .update(done
      ? { followed_up_at: new Date().toISOString(), followed_up_by: access.user.id }
      : { followed_up_at: null, followed_up_by: null })
    .eq('id', formId)
  if (error) return { error: 'Could not save. Please try again.' }

  revalidatePath(`/instructor/courses/${form.course_id}/catch-up`)
  return { ok: true }
}

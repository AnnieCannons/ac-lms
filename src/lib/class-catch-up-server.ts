// Class Catch Up Form — the 5am Pacific absence run. Reads recent Airtable attendance and
// Slack DMs each absent student a link to the catch-up form, once per student per day.
// Takes the service-role client; the cron route is the auth gate (CRON_SECRET).

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAbsencesBetween, type AbsenceRow } from '@/lib/airtable'
import { notifyByEmail } from '@/lib/slack'
import { absenceWindow, absentBlocks, catchUpPath, pickCourseForAbsence, studentAbsenceMessage, type CourseWindow } from '@/lib/class-catch-up'
import { pacificDate } from '@/lib/cutting-edge'

type Admin = ReturnType<typeof createServiceSupabaseClient>

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com').replace(/\/$/, '')

export type AbsenceRunResult = {
  window: { since: string; until: string }
  absences: number
  unmatched: number
  alreadyAlerted: number
  alreadySubmitted: number
  sent: number
  failed: number
}

export async function runAbsenceAlerts(
  admin: Admin,
  now: Date,
  fetchAbsences: (since: string, until: string) => Promise<AbsenceRow[]> = fetchAbsencesBetween,
): Promise<AbsenceRunResult> {
  const window = absenceWindow(now)
  const result: AbsenceRunResult = { window, absences: 0, unmatched: 0, alreadyAlerted: 0, alreadySubmitted: 0, sent: 0, failed: 0 }

  // One entry per student code per day; several rows on one day merge their blocks.
  const byKey = new Map<string, { code: string; date: string; blocks: Set<string> }>()
  for (const row of await fetchAbsences(window.since, window.until)) {
    const blocks = absentBlocks(row.record)
    if (!blocks.length) continue
    const code = row.airtableStudentId.trim().toUpperCase()
    const key = `${code}|${row.date}`
    const entry = byKey.get(key) ?? { code, date: row.date, blocks: new Set<string>() }
    blocks.forEach(b => entry.blocks.add(b))
    byKey.set(key, entry)
  }
  const absences = [...byKey.values()]
  result.absences = absences.length
  if (!absences.length) return result

  const codes = [...new Set(absences.map(a => a.code))]
  const { data: users } = await admin
    .from('users')
    .select('id, name, email, airtable_student_id')
    .in('airtable_student_id', codes)
  const userByCode = new Map<string, { id: string; name: string | null; email: string | null }>()
  for (const u of users ?? []) {
    if (u.airtable_student_id) userByCode.set(String(u.airtable_student_id).trim().toUpperCase(), u)
  }
  const userIds = [...new Set([...userByCode.values()].map(u => u.id))]
  if (!userIds.length) {
    result.unmatched = absences.length
    return result
  }

  const [{ data: enrollments }, { data: alerts }, { data: forms }] = await Promise.all([
    admin
      .from('course_enrollments')
      .select('user_id, courses(id, start_date, end_date, archived, is_template)')
      .in('user_id', userIds)
      .eq('role', 'student'),
    admin
      .from('class_absence_alerts')
      .select('student_id, absence_date')
      .in('student_id', userIds)
      .gte('absence_date', window.since)
      .lte('absence_date', window.until),
    admin
      .from('class_catch_up_forms')
      .select('student_id, submitted_at')
      .in('student_id', userIds)
      .gte('submitted_at', `${window.since}T00:00:00Z`),
  ])

  type EnrollmentRow = { user_id: string; courses: (CourseWindow & { archived: boolean | null; is_template: boolean | null }) | null }
  const coursesByUser = new Map<string, CourseWindow[]>()
  for (const e of (enrollments ?? []) as unknown as EnrollmentRow[]) {
    if (!e.courses || e.courses.archived || e.courses.is_template) continue
    coursesByUser.set(e.user_id, [...(coursesByUser.get(e.user_id) ?? []), e.courses])
  }
  const alerted = new Set((alerts ?? []).map(a => `${a.student_id}|${a.absence_date}`))
  // A form already submitted on or after the absence day covers it (e.g. filled out ahead of time).
  const lastSubmitted = new Map<string, string>()
  for (const f of forms ?? []) {
    const day = pacificDate(f.submitted_at)
    if ((lastSubmitted.get(f.student_id) ?? '') < day) lastSubmitted.set(f.student_id, day)
  }

  for (const a of absences) {
    const user = userByCode.get(a.code)
    const courseId = user ? pickCourseForAbsence(coursesByUser.get(user.id) ?? [], a.date) : null
    if (!user || !courseId) { result.unmatched++; continue }
    if (alerted.has(`${user.id}|${a.date}`)) { result.alreadyAlerted++; continue }
    if ((lastSubmitted.get(user.id) ?? '') >= a.date) { result.alreadySubmitted++; continue }

    const blocks = [...a.blocks].sort()
    // Log first: if another run got here first, the insert returns nothing and we skip.
    const { data: inserted } = await admin
      .from('class_absence_alerts')
      .upsert(
        { student_id: user.id, absence_date: a.date, course_id: courseId, blocks },
        { onConflict: 'student_id,absence_date', ignoreDuplicates: true },
      )
      .select('student_id')
    if (!inserted?.length) { result.alreadyAlerted++; continue }

    const link = `${appUrl()}${catchUpPath(courseId, a.date)}`
    const sent = user.email
      ? await notifyByEmail(user.email, studentAbsenceMessage(user.name ?? 'there', a.date, blocks, link)).catch(() => false)
      : false
    if (sent) {
      result.sent++
      await admin.from('class_absence_alerts').update({ slack_sent: true }).eq('student_id', user.id).eq('absence_date', a.date)
    } else {
      result.failed++
    }
  }
  return result
}

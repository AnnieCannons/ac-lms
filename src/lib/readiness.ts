// Server-side only — weekly readiness score + escalation state machine for the
// student-accountability feature. Reuses the Mon–Thu week/course/attendance
// plumbing already built for the Friday instructor digest (see weekly-report.ts).

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchClassAttendanceWeekly, type ClassStudentWeekly } from '@/lib/airtable'
import { computeStudentAssignmentStats, countNeedsRevisionEvents } from '@/lib/student-stats-actions'
import {
  detectTrack,
  getCourseStudents,
  getWeekRanges,
  isCurrentCourse,
  resolveAirtableCourseName,
  TRACK_CHANNELS,
  type CourseRow,
} from '@/lib/weekly-report'
import { notifyByEmail, openGroupDM, slackLookupByEmail, slackPostMessage } from '@/lib/slack'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

export type Zone = 'red' | 'yellow' | 'green'

/**
 * score = 5, minus 1 whole point per every full 2 blocks missed that week,
 * minus 1 whole point per every full 3 missing assignments, minus 1 whole
 * point per every full 2 times a submission was returned as Needs Revision
 * *during* that week -- every return counts (from grade_history), not just
 * whatever is still sitting in that state when this runs, so resubmitting
 * unfinished work just to clear the current-state count no longer helps.
 * Stepped, not continuous -- e.g. 1 needs-revision return costs nothing, 2
 * cost exactly 1 point, 3 still only cost 1 point. Weights and the 0-5 scale
 * were set directly by the program (student-accountability feature), not
 * inferred from data.
 */
export function computeReadinessScore(
  missingCount: number,
  needsRevisionCount: number,
  blocksMissed: number,
): number {
  const raw = 5
    - Math.floor(blocksMissed / 2)
    - Math.floor(missingCount / 3)
    - Math.floor(needsRevisionCount / 2)
  return Math.max(0, Math.min(5, raw))
}

export function zoneForScore(score: number): Zone {
  if (score >= 4) return 'green'
  if (score >= 2) return 'yellow'
  return 'red'
}

const ZONE_RANK: Record<Zone, number> = { red: 0, yellow: 1, green: 2 }

function isBetterZone(zone: Zone, than: Zone): boolean {
  return ZONE_RANK[zone] > ZONE_RANK[than]
}

export type EscalationStatus = 'none' | 'step1' | 'step2' | 'step3' | 'resolved'

type EscalationStateRow = {
  id: string
  status: EscalationStatus
  zone_at_step_start: Zone | null
  consecutive_good_weeks: number
  grace_week_used: boolean
}

type EscalationEventType =
  | 'step1_started' | 'step1_reminder' | 'step1_completed'
  | 'step2_started' | 'step2_reminder' | 'step2_completed'
  | 'step3_started'
  | 'reset' | 'manual_note'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.anniecannons.com'
const ROBYN_EMAIL = process.env.STUDENT_SUCCESS_MANAGER_EMAIL
const DAWN_EMAIL = process.env.CAREER_DEV_MANAGER_EMAIL

async function studentContactEmail(admin: AdminClient, studentId: string): Promise<{ name: string; email: string } | null> {
  const { data } = await admin.from('users').select('name, email, slack_email').eq('id', studentId).single()
  type Row = { name: string; email: string; slack_email: string | null }
  const row = data as Row | null
  return row ? { name: row.name, email: row.slack_email ?? row.email } : null
}

async function sendStep1(admin: AdminClient, studentId: string): Promise<void> {
  const student = await studentContactEmail(admin, studentId)
  if (!student) return
  await notifyByEmail(
    student.email,
    `Hi ${student.name}! We noticed you've had a tough week or two. Can you take a minute to fill out a quick check-in? ${APP_URL}/student/readiness`,
  )
}

async function sendStep2(admin: AdminClient, studentId: string): Promise<void> {
  const student = await studentContactEmail(admin, studentId)
  if (!student) return
  await notifyByEmail(
    student.email,
    `Hi ${student.name}, since things haven't turned around yet, we'd like you to fill out a short goals & reflection check-in. ${APP_URL}/student/readiness`,
  )
}

async function sendStep3(admin: AdminClient, studentId: string, courseId: string): Promise<void> {
  const student = await studentContactEmail(admin, studentId)
  const { data: instructorRows } = await admin
    .from('course_enrollments')
    .select('users(email, slack_email)')
    .eq('course_id', courseId)
    .eq('role', 'instructor')
  type Row = { users: { email: string; slack_email: string | null } | null }
  const instructorEmails = ((instructorRows as unknown as Row[]) ?? [])
    .map(r => r.users?.slack_email ?? r.users?.email)
    .filter((e): e is string => !!e)

  const emails = [student?.email, ...instructorEmails, ROBYN_EMAIL, DAWN_EMAIL]
    .filter((e): e is string => !!e)

  const slackIds = (await Promise.all(emails.map(slackLookupByEmail))).filter((id): id is string => !!id)
  if (slackIds.length < 2) {
    console.warn(`readiness: could not resolve enough Slack IDs for step3 group DM (student ${studentId})`)
    return
  }

  const channel = await openGroupDM(slackIds)
  if (!channel) return
  const name = student?.name ?? 'this student'
  await slackPostMessage(
    channel,
    `Hi all — ${name} has been in the student accountability process for a couple of weeks without getting back to a good standing. Let's find a time to meet and get on the same page. :calendar:`,
  )
}

const FOLLOW_UP_PROMPT =
  "Who will follow up with the student regarding this? If there is a staff member already working with the student, it should be them. Otherwise the instructor should follow up unless they are feeling like they need more support. If you would like more support, please let us know here."

/**
 * Posts to the student's track monitor channel when they complete a step1/step2
 * check-in, linking straight to the staff roster view where the full response
 * is readable (via "View response" in the accountability history).
 */
export async function notifyStaffOfCheckinCompletion(
  admin: AdminClient,
  studentId: string,
  courseId: string,
  formType: 'acknowledgment' | 'reflection',
): Promise<void> {
  const { data: courseRow } = await admin
    .from('courses')
    .select('name, airtable_course_name')
    .eq('id', courseId)
    .single()
  type Course = { name: string; airtable_course_name: string | null }
  const course = courseRow as Course | null
  const track = course ? detectTrack(course.name, course.airtable_course_name) : null
  if (!track) return

  const { data: studentRow } = await admin.from('users').select('name').eq('id', studentId).single()
  const studentName = (studentRow as { name: string } | null)?.name ?? 'A student'
  const formLabel = formType === 'acknowledgment' ? 'step 1 check-in' : 'step 2 reflection'
  const link = `${APP_URL}/instructor/courses/${courseId}/roster/${studentId}`

  await slackPostMessage(
    TRACK_CHANNELS[track],
    `*${studentName}* just completed their ${formLabel}: ${link}\n\n${FOLLOW_UP_PROMPT}`,
  )
}

async function countYellowWeeksInWindow(
  admin: AdminClient,
  studentId: string,
  courseId: string,
  uptoWeekStart: string,
): Promise<number> {
  const { data } = await admin
    .from('student_stats_snapshots')
    .select('readiness_score')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .lte('week_start', uptoWeekStart)
    .order('week_start', { ascending: false })
    .limit(4)

  type Row = { readiness_score: number | null }
  return ((data as Row[]) ?? []).filter(
    r => r.readiness_score != null && zoneForScore(r.readiness_score) === 'yellow',
  ).length
}

type WeeklyResult = { score: number; zone: Zone }

/**
 * Runs the escalation trigger/advance/reset rules for one student for the week
 * that was just scored. See the "Escalation State Machine" section of the
 * student-accountability plan for the exact rules — they were specified
 * directly by the program, not inferred.
 */
async function evaluateEscalationForStudent(
  admin: AdminClient,
  studentId: string,
  courseId: string,
  weekStart: string,
  result: WeeklyResult,
): Promise<void> {
  // Guard against reprocessing a week that's already been evaluated (e.g. a
  // manual re-run, a retry, or the cron firing twice within its self-gated
  // hour) -- without this, re-running the same week_start would advance the
  // escalation state a second time for no new data.
  const { data: alreadyProcessed } = await admin
    .from('escalation_events')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('week_start', weekStart)
    .limit(1)
  if (alreadyProcessed && alreadyProcessed.length > 0) return

  const { data: existing } = await admin
    .from('escalation_states')
    .select('id, status, zone_at_step_start, consecutive_good_weeks, grace_week_used')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle()

  const state = existing as EscalationStateRow | null
  const nowIso = new Date().toISOString()

  const logEvent = async (event_type: EscalationEventType, note?: string) => {
    await admin.from('escalation_events').insert({
      student_id: studentId,
      course_id: courseId,
      week_start: weekStart,
      event_type,
      score: result.score,
      note: note ?? null,
    })
  }

  // No active process -- check whether this week's score should start one.
  if (!state || state.status === 'none') {
    if (result.zone === 'red') {
      await admin.from('escalation_states').upsert({
        student_id: studentId,
        course_id: courseId,
        status: 'step1',
        step_started_at: nowIso,
        zone_at_step_start: result.zone,
        trigger_reason: 'red_zone',
        consecutive_good_weeks: 0,
        grace_week_used: false,
        reminder_sent_at: null,
      }, { onConflict: 'student_id,course_id' })
      await logEvent('step1_started', 'red zone')
      await sendStep1(admin, studentId)
      return
    }

    if (result.zone === 'yellow') {
      const yellowWeeks = await countYellowWeeksInWindow(admin, studentId, courseId, weekStart)
      if (yellowWeeks >= 2) {
        await admin.from('escalation_states').upsert({
          student_id: studentId,
          course_id: courseId,
          status: 'step1',
          step_started_at: nowIso,
          zone_at_step_start: result.zone,
          trigger_reason: 'yellow_zone_pattern',
          consecutive_good_weeks: 0,
          grace_week_used: false,
          reminder_sent_at: null,
        }, { onConflict: 'student_id,course_id' })
        await logEvent('step1_started', `${yellowWeeks} of last 4 weeks in yellow zone`)
        await sendStep1(admin, studentId)
      }
    }
    return
  }

  if (state.status === 'resolved') return // manually closed -- don't auto-reopen

  // Active process: update the good-standing streak first; 2 consecutive green
  // weeks resets regardless of which step the student is on.
  const goodStreak = result.zone === 'green' ? state.consecutive_good_weeks + 1 : 0

  if (goodStreak >= 2) {
    await admin.from('escalation_states').update({
      status: 'none',
      consecutive_good_weeks: 0,
      grace_week_used: false,
      step_started_at: null,
      reminder_sent_at: null,
      zone_at_step_start: null,
      trigger_reason: null,
    }).eq('id', state.id)
    await logEvent('reset', '2 consecutive weeks in good standing')
    return
  }

  await admin.from('escalation_states').update({ consecutive_good_weeks: goodStreak }).eq('id', state.id)

  // A green week never advances a step on its own -- it only counts toward the
  // 2-consecutive-week reset handled above. Only a non-green week is evaluated
  // for advancement here.
  if (result.zone === 'green') return

  const madeProgress = isBetterZone(result.zone, state.zone_at_step_start ?? 'red')

  if (state.status === 'step1') {
    if (madeProgress && !state.grace_week_used) {
      // Some progress, but not yet green -- give one more week before advancing.
      await admin.from('escalation_states').update({ grace_week_used: true }).eq('id', state.id)
      return
    }
    await admin.from('escalation_states').update({
      status: 'step2',
      step_started_at: nowIso,
      zone_at_step_start: result.zone,
      grace_week_used: false,
      reminder_sent_at: null,
    }).eq('id', state.id)
    await logEvent('step2_started')
    await sendStep2(admin, studentId)
    return
  }

  if (state.status === 'step2') {
    // No grace week for step2 -> step3: any non-green result advances.
    await admin.from('escalation_states').update({
      status: 'step3',
      step_started_at: nowIso,
      zone_at_step_start: result.zone,
      grace_week_used: false,
      reminder_sent_at: null,
    }).eq('id', state.id)
    await logEvent('step3_started')
    await sendStep3(admin, studentId, courseId)
    return
  }

  // step3: no further automated advancement -- stays until a staff member resolves it.
}

export type ReadinessJobResult = { courses: string[] }

/**
 * Monday-morning job: scores every student in every current course for the
 * week that just ended (Mon-Thu). Missing-assignment count is *live* (as of
 * when this runs) so weekend catch-up counts in the student's favor, but the
 * needs-revision count is a historical tally of every return that happened
 * during that week -- it can't be "caught up" by resubmitting. Upserts
 * student_stats_snapshots and runs the escalation state machine.
 */
export async function runReadinessJob(admin: AdminClient, now: Date, onlyCourseId?: string): Promise<ReadinessJobResult> {
  const { data: courses } = await admin
    .from('courses')
    .select('id, name, start_date, end_date, is_template, archived, airtable_course_name')

  type CourseRecord = CourseRow & { id: string; start_date: string | null; end_date: string | null }
  const allCourses = (courses as CourseRecord[]) ?? []

  const weekRanges = getWeekRanges(now)
  const scoredCourses: string[] = []

  for (const course of allCourses) {
    if (onlyCourseId && (course as unknown as { id: string }).id !== onlyCourseId) continue
    if (course.is_template || course.archived) continue
    if (!isCurrentCourse(course.start_date, course.end_date)) continue

    const track = detectTrack(course.name, course.airtable_course_name)
    if (!track) continue

    const airtableCourseName = resolveAirtableCourseName(course, allCourses)
    const students = await getCourseStudents(admin, (course as unknown as { id: string }).id, { excludeTestAccounts: false })
    if (students.length === 0) continue

    const courseId = (course as unknown as { id: string }).id

    // Keyed by airtable_student_id when known (safe even if two students share a
    // display name); also indexed by normalized name as a fallback for
    // enrollments not yet backfilled with airtable_student_id -- see the same
    // pattern in buildCourseReport (weekly-report.ts).
    const attendanceMap = new Map<string, ClassStudentWeekly>()
    if (airtableCourseName) {
      try {
        const weekly = await fetchClassAttendanceWeekly(airtableCourseName, weekRanges.thisWeek, weekRanges.lastWeek)
        for (const w of weekly) {
          if (w.airtableStudentId) attendanceMap.set(w.airtableStudentId, w)
          const nameKey = w.preferredName.trim().toLowerCase()
          if (!attendanceMap.has(nameKey)) attendanceMap.set(nameKey, w)
        }
      } catch (e) {
        console.warn(`readiness-score: attendance fetch failed for ${course.name}:`, e)
      }
    }

    for (const student of students) {
      const stats = await computeStudentAssignmentStats(admin, student.id, courseId)
      const attendance = (student.airtableStudentId && attendanceMap.get(student.airtableStudentId))
        || attendanceMap.get(student.name.trim().toLowerCase())
      const attendancePctMissed = attendance && attendance.blocksLastWeek > 0
        ? (attendance.absencesLastWeek / attendance.blocksLastWeek) * 100
        : 0

      const missingCount = stats.missing.length
      const needsRevisionCount = await countNeedsRevisionEvents(
        admin, student.id, courseId, weekRanges.lastWeek.start, weekRanges.lastWeek.end,
      )
      const blocksMissed = attendance?.absencesLastWeek ?? 0
      const score = computeReadinessScore(missingCount, needsRevisionCount, blocksMissed)
      const zone = zoneForScore(score)

      await admin.from('student_stats_snapshots').upsert({
        student_id: student.id,
        course_id: courseId,
        week_start: weekRanges.lastWeek.start,
        missing_count: missingCount,
        needs_revision_count: needsRevisionCount,
        attendance_pct_missed: attendancePctMissed,
        blocks_missed: attendance?.absencesLastWeek ?? 0,
        blocks_total: attendance?.blocksLastWeek ?? 0,
        readiness_score: score,
      }, { onConflict: 'student_id,course_id,week_start' })

      await evaluateEscalationForStudent(admin, student.id, courseId, weekRanges.lastWeek.start, { score, zone })
    }

    scoredCourses.push(course.name)
  }

  return { courses: scoredCourses }
}

async function hasCompletedCheckin(
  admin: AdminClient,
  studentId: string,
  courseId: string,
  status: 'step1' | 'step2',
  sinceIso: string,
): Promise<boolean> {
  const formType = status === 'step1' ? 'acknowledgment' : 'reflection'
  const { data } = await admin
    .from('accountability_checkins')
    .select('id')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .eq('form_type', formType)
    .gte('created_at', sinceIso)
    .limit(1)
  return !!(data && data.length > 0)
}

export type EscalationReminderResult = { reminded: number }

/**
 * Checks for step1/step2 students who haven't completed their check-in within
 * 48 hours and haven't already been reminded, and posts a staff-visibility
 * nudge to the student's track monitor channel (not another DM to the
 * student -- this reminder doesn't address the student directly).
 */
export async function runEscalationReminders(admin: AdminClient, cutoffHours = 48, onlyCourseId?: string): Promise<EscalationReminderResult> {
  const cutoff = new Date(Date.now() - cutoffHours * 60 * 60 * 1000).toISOString()
  let query = admin
    .from('escalation_states')
    .select('id, student_id, course_id, status, step_started_at')
    .in('status', ['step1', 'step2'])
    .lte('step_started_at', cutoff)
    .is('reminder_sent_at', null)
  if (onlyCourseId) query = query.eq('course_id', onlyCourseId)
  const { data } = await query

  type Row = { id: string; student_id: string; course_id: string; status: 'step1' | 'step2'; step_started_at: string }
  let reminded = 0

  for (const row of (data as Row[]) ?? []) {
    const completed = await hasCompletedCheckin(admin, row.student_id, row.course_id, row.status, row.step_started_at)
    if (completed) continue

    const { data: courseRow } = await admin
      .from('courses')
      .select('name, airtable_course_name')
      .eq('id', row.course_id)
      .single()
    type Course = { name: string; airtable_course_name: string | null }
    const course = courseRow as Course | null
    const track = course ? detectTrack(course.name, course.airtable_course_name) : null

    const { data: studentRow } = await admin.from('users').select('name').eq('id', row.student_id).single()
    const studentName = (studentRow as { name: string } | null)?.name ?? 'A student'

    if (track) {
      const stepLabel = row.status === 'step1' ? '1' : '2'
      await slackPostMessage(
        TRACK_CHANNELS[track],
        `Heads up: *${studentName}* hasn't completed their step ${stepLabel} accountability check-in yet (sent 48h+ ago).`,
      )
    }

    await admin.from('escalation_states').update({ reminder_sent_at: new Date().toISOString() }).eq('id', row.id)
    await admin.from('escalation_events').insert({
      student_id: row.student_id,
      course_id: row.course_id,
      event_type: row.status === 'step1' ? 'step1_reminder' : 'step2_reminder',
    })
    reminded++
  }

  return { reminded }
}

'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { zoneForScore, notifyStaffOfCheckinCompletion, type Zone, type EscalationStatus } from '@/lib/readiness'
import { computeClassAverages, isTesterEmail, normalizeEmail, type ClassAverages } from '@/lib/readiness-summary'
import { EXCLUDED_STUDENT_USER_IDS } from '@/lib/excluded-students'
import { fetchAllRows } from '@/lib/supabase/paginate'

export type ReadinessHistoryPoint = {
  weekStart: string
  weekNumber: number
  score: number | null
  zone: Zone | null
  missing: number
  needsRevision: number
  attendancePctMissed: number | null
  blocksMissed: number | null
  blocksTotal: number | null
}

type SnapshotRow = {
  week_start: string
  missing_count: number
  needs_revision_count: number
  attendance_pct_missed: number | null
  blocks_missed: number | null
  blocks_total: number | null
  readiness_score: number | null
}

const SNAPSHOT_COLUMNS = 'week_start, missing_count, needs_revision_count, attendance_pct_missed, blocks_missed, blocks_total, readiness_score'

/** Monday of the week containing this date, as a YYYY-MM-DD string. */
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return d.toISOString().slice(0, 10)
}

/** 1-indexed week number relative to the course's first Monday -- stays stable
 * across a skipped break week (e.g. Thanksgiving), unlike an array index. */
function weekNumberFor(weekStart: string, courseWeek1Monday: string): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const diff = new Date(`${weekStart}T00:00:00`).getTime() - new Date(`${courseWeek1Monday}T00:00:00`).getTime()
  return Math.round(diff / msPerWeek) + 1
}

function toHistoryPoint(r: SnapshotRow, courseWeek1Monday: string): ReadinessHistoryPoint {
  return {
    weekStart: r.week_start,
    weekNumber: weekNumberFor(r.week_start, courseWeek1Monday),
    score: r.readiness_score,
    zone: r.readiness_score != null ? zoneForScore(r.readiness_score) : null,
    missing: r.missing_count,
    needsRevision: r.needs_revision_count,
    attendancePctMissed: r.attendance_pct_missed,
    blocksMissed: r.blocks_missed,
    blocksTotal: r.blocks_total,
  }
}

async function getCourseWeek1Monday(admin: ReturnType<typeof createServiceSupabaseClient>, courseId: string): Promise<string> {
  const { data: course } = await admin.from('courses').select('start_date').eq('id', courseId).single()
  return mondayOf(course?.start_date ?? new Date().toISOString().slice(0, 10))
}

/** A student's own weekly readiness history for a course. */
export async function getMyReadinessHistory(courseId: string): Promise<ReadinessHistoryPoint[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceSupabaseClient()
  const [{ data }, week1Monday] = await Promise.all([
    admin
      .from('student_stats_snapshots')
      .select(SNAPSHOT_COLUMNS)
      .eq('student_id', user.id)
      .eq('course_id', courseId)
      .order('week_start', { ascending: true }),
    getCourseWeek1Monday(admin, courseId),
  ])

  return ((data as SnapshotRow[]) ?? []).map(r => toHistoryPoint(r, week1Monday))
}

/** Staff/instructor/admin view of any student's weekly readiness history. */
export async function getReadinessHistory(studentId: string, courseId: string): Promise<ReadinessHistoryPoint[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  const admin = createServiceSupabaseClient()
  const [{ data }, week1Monday] = await Promise.all([
    admin
      .from('student_stats_snapshots')
      .select(SNAPSHOT_COLUMNS)
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .order('week_start', { ascending: true }),
    getCourseWeek1Monday(admin, courseId),
  ])

  return ((data as SnapshotRow[]) ?? []).map(r => toHistoryPoint(r, week1Monday))
}

export type CourseReadinessRow = {
  studentId: string
  name: string
  avatarUrl: string | null
  /** This student's snapshot for the selected week, or null if they weren't scored that week. */
  week: ReadinessHistoryPoint | null
}

export type CourseReadinessWeek = {
  /** Every week_start with at least one snapshot in this course, ascending. */
  weeks: string[]
  /** The selected week, or null when the course has no snapshots yet. */
  weekStart: string | null
  weekNumber: number | null
  rows: CourseReadinessRow[]
  averages: ClassAverages
  /** Same averages for the week before the selected one, for week-over-week deltas. */
  previousAverages: ClassAverages | null
}

type EnrolledUserRow = {
  user_id: string
  users: { id: string; name: string | null; email: string | null; avatar_url: string | null } | { id: string; name: string | null; email: string | null; avatar_url: string | null }[] | null
}

const ZONE_SORT_ORDER: Record<Zone, number> = { red: 0, yellow: 1, green: 2 }

/**
 * Whole-class readiness for one week (defaults to the most recent scored week)
 * -- staff/instructor/admin only. Excludes known non-actionable accounts
 * (EXCLUDED_STUDENT_USER_IDS: QA, graduated, withdrawn) and staff tester
 * accounts (see isTesterEmail) from both the table and the averages.
 */
export async function getCourseReadinessWeek(courseId: string, requestedWeek?: string): Promise<CourseReadinessWeek> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  const admin = createServiceSupabaseClient()

  const [{ data: enrollments }, { data: staffUsers }, week1Monday, weekRows] = await Promise.all([
    admin
      .from('course_enrollments')
      .select('user_id, users(id, name, email, avatar_url)')
      .eq('course_id', courseId)
      .eq('role', 'student'),
    admin.from('users').select('email').in('role', ['staff', 'instructor', 'admin']),
    getCourseWeek1Monday(admin, courseId),
    fetchAllRows<{ week_start: string }>((from, to) =>
      admin.from('student_stats_snapshots').select('week_start').eq('course_id', courseId).range(from, to),
    ),
  ])

  const staffEmails = new Set(
    ((staffUsers as { email: string | null }[] | null) ?? []).flatMap(u => (u.email ? [normalizeEmail(u.email)] : [])),
  )

  const students = ((enrollments as unknown as EnrolledUserRow[]) ?? [])
    .map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return { studentId: e.user_id, name: u?.name ?? '', email: u?.email ?? null, avatarUrl: u?.avatar_url ?? null }
    })
    .filter(s => !EXCLUDED_STUDENT_USER_IDS.has(s.studentId) && !isTesterEmail(s.email, staffEmails))
    .map(s => ({ studentId: s.studentId, name: s.name, avatarUrl: s.avatarUrl }))

  const weeks = [...new Set(weekRows.map(r => r.week_start))].sort()
  const weekStart = requestedWeek && weeks.includes(requestedWeek) ? requestedWeek : (weeks.at(-1) ?? null)
  const previousWeek = weekStart ? (weeks[weeks.indexOf(weekStart) - 1] ?? null) : null

  const empty: CourseReadinessWeek = {
    weeks,
    weekStart,
    weekNumber: weekStart ? weekNumberFor(weekStart, week1Monday) : null,
    rows: students.map(s => ({ ...s, week: null })),
    averages: computeClassAverages([]),
    previousAverages: null,
  }
  if (students.length === 0 || !weekStart) return empty

  const { data: snapshots } = await admin
    .from('student_stats_snapshots')
    .select(`${SNAPSHOT_COLUMNS}, student_id`)
    .eq('course_id', courseId)
    .in('student_id', students.map(s => s.studentId))
    .in('week_start', previousWeek ? [weekStart, previousWeek] : [weekStart])

  const byWeek = new Map<string, Map<string, ReadinessHistoryPoint>>()
  for (const row of (snapshots as (SnapshotRow & { student_id: string })[] | null) ?? []) {
    if (!byWeek.has(row.week_start)) byWeek.set(row.week_start, new Map())
    byWeek.get(row.week_start)!.set(row.student_id, toHistoryPoint(row, week1Monday))
  }
  const current = byWeek.get(weekStart) ?? new Map<string, ReadinessHistoryPoint>()
  const previous = previousWeek ? byWeek.get(previousWeek) : undefined

  const rows = students
    .map(s => ({ ...s, week: current.get(s.studentId) ?? null }))
    .sort((a, b) => {
      const za = a.week?.zone ? ZONE_SORT_ORDER[a.week.zone] : 3
      const zb = b.week?.zone ? ZONE_SORT_ORDER[b.week.zone] : 3
      if (za !== zb) return za - zb
      return a.name.localeCompare(b.name)
    })

  return {
    ...empty,
    rows,
    averages: computeClassAverages([...current.values()]),
    previousAverages: previous ? computeClassAverages([...previous.values()]) : null,
  }
}

export type CheckinContent = {
  formType: CheckinFormType
  note: string | null
  goals: string | null
  reflection: string | null
  obstacles: string | null
  targetGreenDate: string | null
  questionsForInstructor: string | null
}

export type EscalationEventRecord = {
  id: string
  weekStart: string | null
  eventType: string
  score: number | null
  note: string | null
  createdAt: string
  checkin?: CheckinContent
}

type EventRow = {
  id: string
  week_start: string | null
  event_type: string
  score: number | null
  note: string | null
  created_at: string
}

type CheckinRow = {
  escalation_event_id: string | null
  form_type: CheckinFormType
  note: string | null
  goals: string | null
  reflection: string | null
  obstacles: string | null
  target_green_date: string | null
  questions_for_instructor: string | null
}

async function fetchEscalationHistory(studentId: string, courseId: string): Promise<EscalationEventRecord[]> {
  const admin = createServiceSupabaseClient()
  const [{ data }, { data: checkinRows }] = await Promise.all([
    admin
      .from('escalation_events')
      .select('id, week_start, event_type, score, note, created_at')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .order('created_at', { ascending: true }),
    admin
      .from('accountability_checkins')
      .select('escalation_event_id, form_type, note, goals, reflection, obstacles, target_green_date, questions_for_instructor')
      .eq('student_id', studentId)
      .eq('course_id', courseId),
  ])

  // Checkins are stored against the stepN_started event that opened them (see
  // submitCheckinForm) -- build that lookup, then attach content to the
  // stepN_completed event that follows, tracking whichever started event is
  // "current" for each step as we walk the timeline in order.
  const checkinByStartedEvent = new Map<string, CheckinContent>()
  for (const c of (checkinRows as CheckinRow[]) ?? []) {
    if (!c.escalation_event_id) continue
    checkinByStartedEvent.set(c.escalation_event_id, {
      formType: c.form_type, note: c.note, goals: c.goals, reflection: c.reflection, obstacles: c.obstacles,
      targetGreenDate: c.target_green_date, questionsForInstructor: c.questions_for_instructor,
    })
  }

  const events = (data as EventRow[]) ?? []
  let currentStep1Started: string | null = null
  let currentStep2Started: string | null = null

  return events.map(r => {
    if (r.event_type === 'step1_started') currentStep1Started = r.id
    if (r.event_type === 'step2_started') currentStep2Started = r.id

    let checkin: CheckinContent | undefined
    if (r.event_type === 'step1_completed' && currentStep1Started) checkin = checkinByStartedEvent.get(currentStep1Started)
    if (r.event_type === 'step2_completed' && currentStep2Started) checkin = checkinByStartedEvent.get(currentStep2Started)

    return {
      id: r.id,
      weekStart: r.week_start,
      eventType: r.event_type,
      score: r.score,
      note: r.note,
      createdAt: r.created_at,
      checkin,
    }
  })
}

/** A student's own escalation timeline for a course. */
export async function getMyEscalationHistory(courseId: string): Promise<EscalationEventRecord[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return fetchEscalationHistory(user.id, courseId)
}

/** Full escalation timeline for a student -- staff/instructor/admin only. */
export async function getEscalationHistory(studentId: string, courseId: string): Promise<EscalationEventRecord[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  return fetchEscalationHistory(studentId, courseId)
}

/** A student's own current escalation status (drives which check-in form, if any, shows on their readiness page). */
export async function getMyEscalationStatus(courseId: string): Promise<{ status: EscalationStatus } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('escalation_states')
    .select('status')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  return data ? { status: (data as { status: EscalationStatus }).status } : null
}

export type CheckinFormType = 'acknowledgment' | 'reflection'

/** Submits a student's step1 (acknowledgment) or step2 (reflection) check-in form. */
export async function submitCheckinForm(input: {
  courseId: string
  formType: CheckinFormType
  note?: string
  goals?: string
  reflection?: string
  obstacles?: string
  targetGreenDate?: string
  questionsForInstructor?: string
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceSupabaseClient()

  const { data: stateRow } = await admin
    .from('escalation_states')
    .select('status')
    .eq('student_id', user.id)
    .eq('course_id', input.courseId)
    .maybeSingle()

  const expectedStatus = input.formType === 'acknowledgment' ? 'step1' : 'step2'
  if (!stateRow || (stateRow as { status: string }).status !== expectedStatus) {
    return { error: 'No matching check-in is currently open.' }
  }

  const { data: eventRow } = await admin
    .from('escalation_events')
    .select('id')
    .eq('student_id', user.id)
    .eq('course_id', input.courseId)
    .eq('event_type', input.formType === 'acknowledgment' ? 'step1_started' : 'step2_started')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await admin.from('accountability_checkins').insert({
    student_id: user.id,
    course_id: input.courseId,
    escalation_event_id: eventRow ? (eventRow as { id: string }).id : null,
    form_type: input.formType,
    note: input.note ?? null,
    goals: input.goals ?? null,
    reflection: input.reflection ?? null,
    obstacles: input.obstacles ?? null,
    target_green_date: input.targetGreenDate ?? null,
    questions_for_instructor: input.questionsForInstructor ?? null,
  })
  if (error) return { error: error.message }

  await admin.from('escalation_events').insert({
    student_id: user.id,
    course_id: input.courseId,
    event_type: input.formType === 'acknowledgment' ? 'step1_completed' : 'step2_completed',
  })

  await notifyStaffOfCheckinCompletion(admin, user.id, input.courseId, input.formType)

  revalidatePath('/student/readiness')
  return {}
}

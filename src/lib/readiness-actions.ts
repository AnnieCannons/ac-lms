'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { zoneForScore, notifyStaffOfCheckinCompletion, type Zone, type EscalationStatus } from '@/lib/readiness'

export type ReadinessHistoryPoint = {
  weekStart: string
  score: number | null
  zone: Zone | null
  missing: number
  needsRevision: number
  attendancePctMissed: number | null
}

type SnapshotRow = {
  week_start: string
  missing_count: number
  needs_revision_count: number
  attendance_pct_missed: number | null
  readiness_score: number | null
}

function toHistoryPoint(r: SnapshotRow): ReadinessHistoryPoint {
  return {
    weekStart: r.week_start,
    score: r.readiness_score,
    zone: r.readiness_score != null ? zoneForScore(r.readiness_score) : null,
    missing: r.missing_count,
    needsRevision: r.needs_revision_count,
    attendancePctMissed: r.attendance_pct_missed,
  }
}

/** A student's own weekly readiness history for a course. */
export async function getMyReadinessHistory(courseId: string): Promise<ReadinessHistoryPoint[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('student_stats_snapshots')
    .select('week_start, missing_count, needs_revision_count, attendance_pct_missed, readiness_score')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .order('week_start', { ascending: true })

  return ((data as SnapshotRow[]) ?? []).map(toHistoryPoint)
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
  const { data } = await admin
    .from('student_stats_snapshots')
    .select('week_start, missing_count, needs_revision_count, attendance_pct_missed, readiness_score')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .order('week_start', { ascending: true })

  return ((data as SnapshotRow[]) ?? []).map(toHistoryPoint)
}

export type CheckinContent = {
  formType: CheckinFormType
  note: string | null
  goals: string | null
  reflection: string | null
  obstacles: string | null
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
      .select('escalation_event_id, form_type, note, goals, reflection, obstacles')
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

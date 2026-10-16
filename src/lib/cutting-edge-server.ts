// Cutting Edge Talks — server-only data loading and notification sending, shared by the
// server actions (cutting-edge-actions.ts) and the reminder cron. Every function takes the
// service-role client; callers are responsible for the role check.

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { notifyByEmail } from '@/lib/slack'
import {
  audienceCourseIds,
  buildReportRows,
  formatDueDate,
  formatEventWhen,
  needsReminder,
  openReminderKinds,
  primaryCourseFor,
  type CourseWindow,
  type CuttingEdgeEvent,
  type CuttingEdgeRsvp,
  type ReminderKind,
} from '@/lib/cutting-edge'

type Admin = ReturnType<typeof createServiceSupabaseClient>

export const EVENT_COLUMNS =
  'id, title, speaker, starts_at, location_text, location_url, about_html, audience_all, block, status, first_published_at, question_due_date, question_html, question_padlet_url, thanks_due_date, thanks_html, thanks_padlet_url, deleted_at'

export type AudienceStudent = {
  id: string
  name: string
  email: string | null
  courseIds: string[]
  /** The course they're grouped under (and that bell links open in) */
  primaryCourseId: string
}

const IN_CHUNK = 200

function chunks<T>(list: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export async function loadCourses(admin: Admin): Promise<CourseWindow[]> {
  return fetchAllRows<CourseWindow>((from, to) =>
    admin.from('courses').select('id, name, start_date, end_date').order('id').range(from, to),
  )
}

export async function loadLimitedCourseIds(admin: Admin, eventId: string): Promise<string[]> {
  const { data } = await admin.from('cutting_edge_event_courses').select('course_id').eq('event_id', eventId)
  return (data ?? []).map(r => r.course_id as string)
}

export async function loadRsvps(admin: Admin, eventId: string): Promise<CuttingEdgeRsvp[]> {
  return fetchAllRows<CuttingEdgeRsvp>((from, to) =>
    admin
      .from('cutting_edge_rsvps')
      .select('event_id, user_id, response, question_done_at, thanks_done_at, missed_at')
      .eq('event_id', eventId)
      .order('user_id')
      .range(from, to),
  )
}

export async function loadUsers(admin: Admin, ids: string[]): Promise<Map<string, { id: string; name: string; email: string | null }>> {
  const map = new Map<string, { id: string; name: string; email: string | null }>()
  for (const part of chunks(ids)) {
    const { data } = await admin.from('users').select('id, name, email').in('id', part)
    for (const u of data ?? []) map.set(u.id, { id: u.id, name: u.name ?? 'Unknown', email: u.email ?? null })
  }
  return map
}

/** Every student (course_enrollments.role = 'student') in the event's audience. */
export async function loadAudience(
  admin: Admin,
  event: Pick<CuttingEdgeEvent, 'id' | 'audience_all' | 'starts_at'>,
  now: Date,
  courses?: CourseWindow[],
): Promise<{ courses: CourseWindow[]; audience: Set<string>; students: AudienceStudent[] }> {
  const allCourses = courses ?? await loadCourses(admin)
  const limited = event.audience_all ? [] : await loadLimitedCourseIds(admin, event.id)
  const audience = audienceCourseIds(event, limited, allCourses, now)
  const courseIds = [...audience]

  const enrollments: { user_id: string; course_id: string }[] = []
  for (const part of chunks(courseIds)) {
    enrollments.push(...await fetchAllRows<{ user_id: string; course_id: string }>((from, to) =>
      admin
        .from('course_enrollments')
        .select('user_id, course_id')
        .in('course_id', part)
        .eq('role', 'student')
        .order('user_id')
        .range(from, to),
    ))
  }

  const byUser = new Map<string, string[]>()
  for (const e of enrollments) byUser.set(e.user_id, [...(byUser.get(e.user_id) ?? []), e.course_id])
  const users = await loadUsers(admin, [...byUser.keys()])
  const courseMap = new Map(allCourses.map(c => [c.id, c]))

  const students: AudienceStudent[] = []
  for (const [userId, ids] of byUser) {
    const u = users.get(userId)
    const primary = primaryCourseFor(ids, audience, courseMap)
    if (!u || !primary) continue
    students.push({ id: userId, name: u.name, email: u.email, courseIds: ids, primaryCourseId: primary })
  }
  return { courses: allCourses, audience, students }
}

// ── Notifications ───────────────────────────────────────────────────────────────────────

export type NotificationKind = 'new_event' | ReminderKind

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com'

export function eventPath(courseId: string, eventId: string, kind: NotificationKind): string {
  const base = `/student/courses/${courseId}/cutting-edge-talks/${eventId}`
  if (kind === 'question_reminder') return `${base}/question`
  if (kind === 'thanks_reminder') return `${base}/thank-you`
  return base
}

function messages(event: Pick<CuttingEdgeEvent, 'title' | 'starts_at' | 'question_due_date' | 'thanks_due_date'>, kind: NotificationKind) {
  if (kind === 'new_event') {
    const bell = `New Cutting Edge Talk: ${event.title} — ${formatEventWhen(event.starts_at)}. RSVP now.`
    return { bell, slack: `🎤 *New Cutting Edge Talk:* ${event.title}\n${formatEventWhen(event.starts_at)}\nLet us know if you're coming — RSVP here:` }
  }
  if (kind === 'question_reminder') {
    const bell = `Reminder: submit your question for ${event.title} by ${formatDueDate(event.question_due_date)}.`
    return { bell, slack: `💬 *Reminder:* you RSVP'd yes to the Cutting Edge Talk *${event.title}*. Submit your question in advance by ${formatDueDate(event.question_due_date)}:` }
  }
  const bell = `Say thank you for ${event.title} by ${formatDueDate(event.thanks_due_date)} (or let us know you didn't make it).`
  return { bell, slack: `🌉 *Thanks for joining* the Cutting Edge Talk *${event.title}*! Add your thank-you to the Padlet by ${formatDueDate(event.thanks_due_date)} — or check "I did not make it" if you couldn't come:` }
}

/**
 * Sends one kind of notification (bell + Slack DM) to the given students, skipping anyone
 * already in the sent-log for this event+kind. The sent-log row is claimed before sending,
 * so concurrent runs can't double-send. A missing Slack match still gets the bell.
 */
export async function sendCuttingEdgeNotifications(
  admin: Admin,
  event: Pick<CuttingEdgeEvent, 'id' | 'title' | 'starts_at' | 'question_due_date' | 'thanks_due_date'>,
  kind: NotificationKind,
  recipients: AudienceStudent[],
): Promise<{ sent: number; slack: number }> {
  if (recipients.length === 0) return { sent: 0, slack: 0 }

  // Claim: insert sent-log rows, ignoring ones that already exist; only the rows we
  // actually inserted are ours to send.
  const claimed = new Set<string>()
  for (const part of chunks(recipients)) {
    const { data, error } = await admin
      .from('cutting_edge_notifications_sent')
      .upsert(part.map(r => ({ event_id: event.id, user_id: r.id, kind })), { onConflict: 'event_id,user_id,kind', ignoreDuplicates: true })
      .select('user_id')
    if (error) {
      console.error('cutting-edge: failed to claim notifications', error)
      continue
    }
    for (const row of data ?? []) claimed.add(row.user_id as string)
  }
  const toSend = recipients.filter(r => claimed.has(r.id))
  if (toSend.length === 0) return { sent: 0, slack: 0 }

  const { bell, slack } = messages(event, kind)

  for (const part of chunks(toSend)) {
    const { error } = await admin.from('notifications').insert(part.map(r => ({
      user_id: r.id,
      type: `cutting_edge_${kind}`,
      course_id: r.primaryCourseId,
      cutting_edge_event_id: event.id,
      message: bell,
    })))
    if (error) console.error('cutting-edge: failed to insert bell notifications', error)
  }

  // Slack DMs a few at a time — one lookup + one post per student.
  let slackSent = 0
  const slackOk: string[] = []
  const queue = toSend.filter(r => r.email)
  const CONCURRENCY = 5
  for (let i = 0; i < queue.length; i += CONCURRENCY) {
    const batch = queue.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(r =>
      notifyByEmail(r.email!, `${slack} ${appUrl()}${eventPath(r.primaryCourseId, event.id, kind)}`).catch(() => false),
    ))
    batch.forEach((r, j) => { if (results[j]) { slackSent++; slackOk.push(r.id) } })
  }
  for (const part of chunks(slackOk)) {
    await admin.from('cutting_edge_notifications_sent').update({ slack_sent: true })
      .eq('event_id', event.id).eq('kind', kind).in('user_id', part)
  }

  return { sent: toSend.length, slack: slackSent }
}

/** First publish: the RSVP prompt to everyone in the audience. */
export async function sendNewEventNotifications(admin: Admin, eventId: string, now = new Date()) {
  const { data: event } = await admin.from('cutting_edge_events').select(EVENT_COLUMNS).eq('id', eventId).single()
  if (!event || event.deleted_at || event.status !== 'published') return { sent: 0, slack: 0 }
  const { students } = await loadAudience(admin, event as CuttingEdgeEvent, now)
  return sendCuttingEdgeNotifications(admin, event as CuttingEdgeEvent, 'new_event', students)
}

/**
 * Daily reminder pass (8:30am Pacific): for each published event with an open reminder
 * window, remind Yes RSVPs who haven't completed the item. Students no longer in the
 * audience are skipped.
 */
export async function runCuttingEdgeReminders(admin: Admin, now = new Date(), onlyEventId?: string) {
  // Any event that could have an open window: started at most ~60 days ago or upcoming.
  const since = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
  let q = admin.from('cutting_edge_events').select(EVENT_COLUMNS)
    .eq('status', 'published').is('deleted_at', null).gte('starts_at', since)
  if (onlyEventId) q = q.eq('id', onlyEventId)
  const { data: events, error } = await q
  if (error) throw new Error(error.message)

  const courses = await loadCourses(admin)
  const results: { eventId: string; kind: ReminderKind; sent: number; slack: number }[] = []

  for (const event of (events ?? []) as CuttingEdgeEvent[]) {
    const kinds = openReminderKinds(event, now)
    if (kinds.length === 0) continue
    const { students } = await loadAudience(admin, event, now, courses)
    const rsvps = new Map((await loadRsvps(admin, event.id)).map(r => [r.user_id, r]))
    for (const kind of kinds) {
      const recipients = students.filter(s => needsReminder(kind, rsvps.get(s.id) ?? null))
      const r = await sendCuttingEdgeNotifications(admin, event, kind, recipients)
      results.push({ eventId: event.id, kind, ...r })
    }
  }
  return { events: events?.length ?? 0, results }
}

// ── Page data ───────────────────────────────────────────────────────────────────────────

export async function loadAllEvents(admin: Admin): Promise<CuttingEdgeEvent[]> {
  const { data, error } = await admin.from('cutting_edge_events').select(EVENT_COLUMNS)
    .is('deleted_at', null).order('starts_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CuttingEdgeEvent[]
}

/**
 * Report rows for one event: every audience student plus anyone with an RSVP row who is no
 * longer in the audience (e.g. the audience was narrowed after they RSVP'd).
 */
export async function loadEventReport(admin: Admin, event: CuttingEdgeEvent, now: Date, courses?: CourseWindow[]) {
  const { students, courses: allCourses } = await loadAudience(admin, event, now, courses)
  const rsvps = await loadRsvps(admin, event.id)
  const audienceIds = new Set(students.map(s => s.id))
  const outsiderIds = rsvps.map(r => r.user_id).filter(id => !audienceIds.has(id))
  const outsiderUsers = await loadUsers(admin, outsiderIds)
  const rows = buildReportRows(
    event,
    students.map(s => ({ id: s.id, name: s.name, courseId: s.primaryCourseId })),
    rsvps,
    [...outsiderUsers.values()].map(u => ({ id: u.id, name: u.name, courseId: null })),
    now,
  )
  return { rows, courses: allCourses }
}

/** Published events a student in `courseId` can see, with their own RSVP row. */
export async function loadStudentEvents(admin: Admin, courseId: string, userId: string | null, now: Date) {
  const [{ data: course }, { data: limited }, { data: events, error }] = await Promise.all([
    admin.from('courses').select('id, name, start_date, end_date').eq('id', courseId).single(),
    admin.from('cutting_edge_event_courses').select('event_id').eq('course_id', courseId),
    admin.from('cutting_edge_events').select(EVENT_COLUMNS)
      .eq('status', 'published').is('deleted_at', null).order('starts_at', { ascending: true }),
  ])
  if (error) throw new Error(error.message)
  if (!course) return []
  const limitedIds = new Set((limited ?? []).map(r => r.event_id as string))

  const visible = ((events ?? []) as CuttingEdgeEvent[]).filter(e =>
    audienceCourseIds(e, limitedIds.has(e.id) ? [courseId] : [], [course], now).has(courseId),
  )
  if (!userId || visible.length === 0) return visible.map(event => ({ event, rsvp: null as CuttingEdgeRsvp | null }))

  const { data: rsvps } = await admin.from('cutting_edge_rsvps')
    .select('event_id, user_id, response, question_done_at, thanks_done_at, missed_at')
    .eq('user_id', userId).in('event_id', visible.map(e => e.id))
  const byEvent = new Map(((rsvps ?? []) as CuttingEdgeRsvp[]).map(r => [r.event_id, r]))
  return visible.map(event => ({ event, rsvp: byEvent.get(event.id) ?? null }))
}

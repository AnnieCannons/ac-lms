// Cutting Edge Talks — pure rules shared by the server actions, the reminder cron and the
// pages. No Supabase here, so it's unit-testable. All "dates" are Pacific calendar dates
// (YYYY-MM-DD); event start times are real instants shown in Pacific.

export const PACIFIC_TZ = 'America/Los_Angeles'
export const REMINDER_HOUR_PACIFIC = 8 // reminders go out at 8:30am Pacific
export const COURSE_DEFAULT_LENGTH_DAYS = 105
const DAY_MS = 24 * 60 * 60 * 1000

export type RsvpResponse = 'yes' | 'no'

export const BLOCKS = ['A', 'B', 'C', 'D'] as const
export type Block = typeof BLOCKS[number]

export type CuttingEdgeEvent = {
  id: string
  title: string
  speaker: string | null
  starts_at: string
  location_text: string | null
  location_url: string | null
  about_html: string | null
  audience_all: boolean
  block: Block | null
  status: 'draft' | 'published'
  first_published_at: string | null
  question_due_date: string
  question_html: string | null
  question_padlet_url: string | null
  thanks_due_date: string
  thanks_html: string | null
  thanks_padlet_url: string | null
  deleted_at: string | null
}

export type CuttingEdgeRsvp = {
  event_id: string
  user_id: string
  response: RsvpResponse | null
  question_done_at: string | null
  thanks_done_at: string | null
  missed_at: string | null
}

export type CourseWindow = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
}

// ── Templates (wording copied from the existing per-course assignments) ─────────────────

export const QUESTION_TEMPLATE_HTML =
  '<p>Before the Cutting Edge Talk, submit at least one question you’d like our speaker to address.</p>' +
  '<p>Your question can be about the speaker’s experience, their role, a technology or skill they use, their career path, or something you’re curious about based on your own learning.</p>' +
  '<p>You don’t need to know everything to ask a good question.</p>' +
  '<p>Questions are collected in advance so we can make the most of our speaker’s limited time and surface topics that will be most useful to the group.</p>' +
  '<p><strong>Done = One question submitted.</strong></p>' +
  '<p>You don’t need to submit multiple questions unless specifically asked.</p>'

export const THANKS_TEMPLATE_HTML =
  '<p>Take a moment to acknowledge our guest’s contribution by adding a short thank-you to the Cutting Edge Talks Padlet.</p>' +
  '<p><strong>Not sure what to write?</strong><br>Use this structure: <strong>Thank them → Name something specific → Share what you took away</strong></p>' +
  '<p><strong>Done = Your message has been added to the Padlet.</strong></p>'

export const QUESTION_TITLE = '💬 Submit Your Question in Advance'
export const THANKS_TITLE = '🌉 Say Thank You & Build Bridges'

// ── Pacific time ────────────────────────────────────────────────────────────────────────

type PacificParts = { year: number; month: number; day: number; hour: number; minute: number }

export function pacificParts(at: Date): PacificParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The Pacific calendar date (YYYY-MM-DD) of an instant. */
export function pacificDate(at: Date | string): string {
  const p = pacificParts(typeof at === 'string' ? new Date(at) : at)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** The Pacific wall-clock time (HH:MM, 24h) of an instant. */
export function pacificTime(at: Date | string): string {
  const p = pacificParts(typeof at === 'string' ? new Date(at) : at)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Converts a Pacific wall-clock date + time to a UTC ISO string, DST-aware. */
export function pacificToUtcIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Pacific is UTC-7 or UTC-8; try both and keep the one that reads back as the wall time.
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(wallAsUtc + offsetHours * 60 * 60 * 1000)
    const p = pacificParts(candidate)
    if (p.year === y && p.month === mo && p.day === d && p.hour === h && p.minute === mi) {
      return candidate.toISOString()
    }
  }
  // A wall time skipped by spring-forward: fall back to the -7 reading.
  return new Date(wallAsUtc + 7 * 60 * 60 * 1000).toISOString()
}

/** Adds whole days to a YYYY-MM-DD date (calendar arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Default due dates: question 7 days before the event, thank-you 7 days after (Pacific). */
export function defaultDueDates(eventDate: string): { questionDueDate: string; thanksDueDate: string } {
  return { questionDueDate: addDays(eventDate, -7), thanksDueDate: addDays(eventDate, 7) }
}

export function formatEventWhen(startsAt: string): string {
  const d = new Date(startsAt)
  const date = d.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })
  return `${date} at ${time} PT`
}

export function formatDueDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Audience ────────────────────────────────────────────────────────────────────────────

/** Whether a course is active at an instant: start_date through end_date (or start + 105 days). */
export function isCourseActiveAt(course: Pick<CourseWindow, 'start_date' | 'end_date'>, at: Date): boolean {
  if (!course.start_date) return false
  const start = new Date(course.start_date).getTime()
  const end = course.end_date ? new Date(course.end_date).getTime() + DAY_MS : start + COURSE_DEFAULT_LENGTH_DAYS * DAY_MS
  const t = at.getTime()
  return t >= start && t <= end
}

/**
 * The courses whose students an event is for. Limited events use their chosen courses.
 * "Everyone" events use courses active on the event date — plus, while the event is still
 * upcoming, courses active right now — so a past event's audience never changes later.
 */
export function audienceCourseIds(
  event: Pick<CuttingEdgeEvent, 'audience_all' | 'starts_at'>,
  limitedCourseIds: string[],
  courses: Pick<CourseWindow, 'id' | 'start_date' | 'end_date'>[],
  now: Date,
): Set<string> {
  if (!event.audience_all) return new Set(limitedCourseIds)
  const startsAt = new Date(event.starts_at)
  const upcoming = startsAt.getTime() > now.getTime()
  return new Set(
    courses
      .filter(c => isCourseActiveAt(c, startsAt) || (upcoming && isCourseActiveAt(c, now)))
      .map(c => c.id),
  )
}

/**
 * Which course a student is grouped under on the report: of their courses in the event's
 * audience, the one that started most recently (their current one).
 */
export function primaryCourseFor(
  studentCourseIds: string[],
  audience: Set<string>,
  courses: Map<string, Pick<CourseWindow, 'start_date'>>,
): string | null {
  const inAudience = studentCourseIds.filter(id => audience.has(id))
  if (inAudience.length === 0) return null
  return inAudience.sort((a, b) => (courses.get(b)?.start_date ?? '').localeCompare(courses.get(a)?.start_date ?? ''))[0]
}

// ── RSVP + assignment rules ─────────────────────────────────────────────────────────────

export function hasStarted(event: Pick<CuttingEdgeEvent, 'starts_at'>, now: Date): boolean {
  return now.getTime() >= new Date(event.starts_at).getTime()
}

/** RSVPs can change any time until the event starts. */
export function canChangeRsvp(event: Pick<CuttingEdgeEvent, 'starts_at'>, now: Date): boolean {
  return !hasStarted(event, now)
}

export function isQuestionRequired(rsvp: Pick<CuttingEdgeRsvp, 'response'> | null): boolean {
  return rsvp?.response === 'yes'
}

/** The thank-you is required only for Yes RSVPs, and only once the event has started. */
export function isThanksRequired(
  event: Pick<CuttingEdgeEvent, 'starts_at'>,
  rsvp: Pick<CuttingEdgeRsvp, 'response'> | null,
  now: Date,
): boolean {
  return rsvp?.response === 'yes' && hasStarted(event, now)
}

export type FollowUpStatus = 'thanked' | 'missed' | 'pending' | 'no_follow_up' | 'not_required'

/**
 * Where a student stands after the event. "missed" = said yes, checked "I did not make it"
 * (excused). "no_follow_up" = said yes, did neither, and the thank-you is past due.
 */
export function followUpStatus(
  event: Pick<CuttingEdgeEvent, 'starts_at' | 'thanks_due_date'>,
  rsvp: Pick<CuttingEdgeRsvp, 'response' | 'thanks_done_at' | 'missed_at'> | null,
  now: Date,
): FollowUpStatus {
  if (rsvp?.thanks_done_at) return 'thanked'
  if (rsvp?.missed_at) return 'missed'
  if (!isThanksRequired(event, rsvp, now)) return 'not_required'
  return pacificDate(now) > event.thanks_due_date ? 'no_follow_up' : 'pending'
}

/**
 * Open Cutting Edge tasks for a student: a question still owed before the talk (said yes,
 * not checked off), or a thank-you owed after it (said yes, neither done nor "did not make it").
 */
export function openTaskCount(items: { event: Pick<CuttingEdgeEvent, 'starts_at'>; rsvp: CuttingEdgeRsvp | null }[], now: Date): number {
  let n = 0
  for (const { event, rsvp } of items) {
    if (rsvp?.response !== 'yes') continue
    if (!hasStarted(event, now)) { if (!rsvp.question_done_at) n++ }
    else if (!rsvp.thanks_done_at && !rsvp.missed_at) n++
  }
  return n
}

/** Fired after a student RSVPs or checks something off, so the nav badge refreshes. */
export const CUTTING_EDGE_TASKS_CHANGED = 'cutting-edge-tasks-changed'

// ── Reminders ───────────────────────────────────────────────────────────────────────────

export type ReminderKind = 'question_reminder' | 'thanks_reminder'

/**
 * Which reminder windows are open today (Pacific). Question: from 2 days before its due
 * date through the due date, while the event hasn't started. Thank-you: from the morning
 * after the event through its due date. The sent-log makes each send once per student.
 */
export function openReminderKinds(
  event: Pick<CuttingEdgeEvent, 'starts_at' | 'question_due_date' | 'thanks_due_date'>,
  now: Date,
): ReminderKind[] {
  const today = pacificDate(now)
  const kinds: ReminderKind[] = []
  if (!hasStarted(event, now) && today >= addDays(event.question_due_date, -2) && today <= event.question_due_date) {
    kinds.push('question_reminder')
  }
  const eventDay = pacificDate(event.starts_at)
  if (today >= addDays(eventDay, 1) && today <= event.thanks_due_date) {
    kinds.push('thanks_reminder')
  }
  return kinds
}

/** Whether a student should get a reminder: Yes RSVPs who haven't done (or been excused from) it. */
export function needsReminder(kind: ReminderKind, rsvp: Pick<CuttingEdgeRsvp, 'response' | 'question_done_at' | 'thanks_done_at' | 'missed_at'> | null): boolean {
  if (rsvp?.response !== 'yes') return false
  if (kind === 'question_reminder') return !rsvp.question_done_at
  return !rsvp.thanks_done_at && !rsvp.missed_at
}

// ── Report ──────────────────────────────────────────────────────────────────────────────

export type ReportStudent = { id: string; name: string; courseId: string | null }

export type ReportRow = ReportStudent & {
  response: RsvpResponse | null
  questionDone: boolean
  followUp: FollowUpStatus
  inAudience: boolean
}

export type ReportSummary = {
  yes: number
  no: number
  noResponse: number
  questionDone: number
  thanked: number
  missed: number
  noFollowUp: number
}

export function buildReportRows(
  event: Pick<CuttingEdgeEvent, 'starts_at' | 'thanks_due_date'>,
  audienceStudents: ReportStudent[],
  rsvps: CuttingEdgeRsvp[],
  outsiders: ReportStudent[],
  now: Date,
): ReportRow[] {
  const byUser = new Map(rsvps.map(r => [r.user_id, r]))
  const row = (s: ReportStudent, inAudience: boolean): ReportRow => {
    const r = byUser.get(s.id) ?? null
    return {
      ...s,
      response: r?.response ?? null,
      questionDone: !!r?.question_done_at,
      followUp: followUpStatus(event, r, now),
      inAudience,
    }
  }
  return [
    ...audienceStudents.map(s => row(s, true)),
    ...outsiders.map(s => row(s, false)),
  ].sort((a, b) => a.name.localeCompare(b.name))
}

export function summarize(rows: ReportRow[]): ReportSummary {
  const audience = rows.filter(r => r.inAudience)
  return {
    yes: audience.filter(r => r.response === 'yes').length,
    no: audience.filter(r => r.response === 'no').length,
    noResponse: audience.filter(r => r.response === null).length,
    questionDone: rows.filter(r => r.questionDone).length,
    thanked: rows.filter(r => r.followUp === 'thanked').length,
    missed: rows.filter(r => r.followUp === 'missed').length,
    noFollowUp: rows.filter(r => r.followUp === 'no_follow_up').length,
  }
}

// ── Links ───────────────────────────────────────────────────────────────────────────────
/** Appends ?from=<courseId> (keeps the course sidebar) plus any extra params. */
export function withFrom(path: string, from?: string, extra?: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

// ── Validation ──────────────────────────────────────────────────────────────────────────

export type EventInput = {
  title: string
  speaker: string
  date: string // YYYY-MM-DD, in the creator's own timezone (form only)
  time: string // HH:MM, in the creator's own timezone (form only)
  /** The real start instant, computed in the creator's browser from date + time */
  startsAt: string
  block: Block | ''
  locationText: string
  locationUrl: string
  aboutHtml: string
  audienceAll: boolean
  courseIds: string[]
  questionDueDate: string
  questionHtml: string
  questionPadletUrl: string
  thanksDueDate: string
  thanksHtml: string
  thanksPadletUrl: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** Returns an error message, or null when the input is valid. */
export function validateEventInput(input: EventInput): string | null {
  if (!input.title.trim()) return 'Title is required.'
  if (!input.speaker.trim()) return 'Speaker is required.'
  if (!DATE_RE.test(input.date)) return 'Event date is required.'
  if (!TIME_RE.test(input.time)) return 'Event time is required.'
  if (!input.startsAt || isNaN(new Date(input.startsAt).getTime())) return 'Event date and time are required.'
  if (!input.locationText.trim()) return 'Where is required.'
  if (input.block && !(BLOCKS as readonly string[]).includes(input.block)) return 'Block must be A, B, C or D.'
  if (!DATE_RE.test(input.questionDueDate)) return 'Question due date is required.'
  if (!DATE_RE.test(input.thanksDueDate)) return 'Thank-you due date is required.'
  if (input.thanksDueDate < input.date) return 'The thank-you can’t be due before the event.'
  if (!input.audienceAll && input.courseIds.length === 0) return 'Pick at least one class, or choose everyone.'
  for (const [label, url] of [
    ['Location link', input.locationUrl],
    ['Question Padlet link', input.questionPadletUrl],
    ['Thank-you Padlet link', input.thanksPadletUrl],
  ] as const) {
    if (url.trim() && !isHttpUrl(url.trim())) return `${label} must be a full http(s) URL.`
  }
  return null
}

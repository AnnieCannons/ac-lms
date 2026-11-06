// Class Catch Up Form — pure rules shared by the student form, the server actions and the
// 5am Pacific absence cron. No database or network access here, so it's all unit-testable.

import { addDays, pacificDate } from '@/lib/cutting-edge'
import { slackEscape } from '@/lib/slack'

/** The absence DMs go out on the run in the 5am Pacific hour. */
export const CATCH_UP_HOUR_PACIFIC = 5

/**
 * How many days back the cron looks. Each run checks yesterday and the two days before,
 * so Monday's run still sees Friday, a missed run is picked up the next day, and
 * attendance entered a day late still gets a DM. The sent-log stops repeats.
 */
export const LOOKBACK_DAYS = 3

export const BLOCKS = ['A', 'B', 'C', 'D'] as const
export type Block = (typeof BLOCKS)[number]

/** The Google Doc linked from the old Airtable form. */
export const CATCH_UP_INSTRUCTIONS_URL =
  'https://docs.google.com/document/d/1Tdj0PFWu98j3JDTBsvHHszxOKGazHUvt0faf2Ftogss/edit?tab=t.0#heading=h.1vg41lkd6ugb'

export function absenceWindow(now: Date): { since: string; until: string } {
  const today = pacificDate(now)
  return { since: addDays(today, -LOOKBACK_DAYS), until: addDays(today, -1) }
}

/** The blocks marked Absent on one Airtable attendance row (same rule as the attendance views). */
export function absentBlocks(row: { blockA: string | null; blockB: string | null; blockC: string | null; blockD: string | null }): Block[] {
  const values: Record<Block, string | null> = { A: row.blockA, B: row.blockB, C: row.blockC, D: row.blockD }
  return BLOCKS.filter(b => values[b]?.includes('Absent'))
}

/** "Block A", "Blocks A and C", "Blocks A, B and D". */
export function formatBlocks(blocks: readonly string[]): string {
  const sorted = [...new Set(blocks)].sort()
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return `Block ${sorted[0]}`
  return `Blocks ${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`
}

/** "Wednesday, October 21" for a YYYY-MM-DD date. */
export function formatAbsenceDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric',
  })
}

/** Pre-fills "Which blocks did you miss on which day(s)?", e.g. "Blocks C and D on Wednesday, October 21". */
export function describeAbsence(date: string, blocks: readonly string[]): string {
  const when = formatAbsenceDate(date)
  return blocks.length ? `${formatBlocks(blocks)} on ${when}` : when
}

export function isDateParam(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

export type CourseWindow = { id: string; start_date: string | null; end_date: string | null }

/**
 * Which of a student's courses an absence belongs to: the one running on that date, and
 * if two overlap (one ending as the next starts) the one that started most recently.
 * Courses without an end date run for 105 days, like everywhere else in the LMS.
 */
export function pickCourseForAbsence(courses: CourseWindow[], date: string): string | null {
  const running = courses.filter(c => {
    if (!c.start_date) return false
    const start = c.start_date.slice(0, 10)
    const end = c.end_date ? c.end_date.slice(0, 10) : addDays(start, 105)
    return start <= date && date <= end
  })
  running.sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
  return running[0]?.id ?? null
}

// ── The form ─────────────────────────────────────────────────────────────────────────

export type CatchUpInput = {
  missedBlocks: string
  lecturesMissed: string
  lectureLinks: string
  assignmentsMissed: string
  makeupPlan: string
  notes?: string | null
}

export const FIELD_LIMITS: Record<keyof CatchUpInput, number> = {
  missedBlocks: 2000,
  lecturesMissed: 5000,
  lectureLinks: 5000,
  assignmentsMissed: 5000,
  makeupPlan: 5000,
  notes: 5000,
}

export const FIELD_LABELS: Record<keyof CatchUpInput, string> = {
  missedBlocks: 'Which blocks did you miss on which day(s)?',
  lecturesMissed: 'Which lectures/subjects did you miss?',
  lectureLinks: 'Paste the links to the lectures here',
  assignmentsMissed: 'Which assignments did you miss?',
  makeupPlan: 'What is your plan to make up the work?',
  notes: 'Notes/Comments',
}

const REQUIRED: (keyof CatchUpInput)[] = ['missedBlocks', 'lecturesMissed', 'lectureLinks', 'assignmentsMissed', 'makeupPlan']

export function validateCatchUpInput(input: CatchUpInput): { value: Required<CatchUpInput> } | { error: string } {
  const value = {
    missedBlocks: (input.missedBlocks ?? '').trim(),
    lecturesMissed: (input.lecturesMissed ?? '').trim(),
    lectureLinks: (input.lectureLinks ?? '').trim(),
    assignmentsMissed: (input.assignmentsMissed ?? '').trim(),
    makeupPlan: (input.makeupPlan ?? '').trim(),
    notes: (input.notes ?? '').trim() || null,
  }
  for (const key of REQUIRED) {
    if (!value[key]) return { error: `Please answer "${FIELD_LABELS[key]}"` }
  }
  for (const key of Object.keys(FIELD_LIMITS) as (keyof CatchUpInput)[]) {
    const text = value[key]
    if (text && text.length > FIELD_LIMITS[key]) {
      return { error: `"${FIELD_LABELS[key]}" is too long (${FIELD_LIMITS[key].toLocaleString()} characters max).` }
    }
  }
  return { value: value as Required<CatchUpInput> }
}

// ── Slack messages ───────────────────────────────────────────────────────────────────

export function catchUpPath(courseId: string, date?: string | null): string {
  return `/student/courses/${courseId}/catch-up${date ? `?date=${date}` : ''}`
}

export function studentAbsenceMessage(name: string, date: string, blocks: readonly string[], link: string): string {
  const first = slackEscape(name.split(' ')[0] || name)
  return `Hi ${first}! We missed you in class (${describeAbsence(date, blocks)}). ` +
    `Please fill out the Class Catch Up Form so your instructor knows your plan to make up the work: ${link}`
}

function clip(text: string, max = 400): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function instructorFollowUpMessage(
  studentName: string,
  courseName: string,
  form: Pick<CatchUpInput, 'missedBlocks' | 'makeupPlan'>,
  link: string,
): string {
  return [
    `📝 *${slackEscape(studentName)}* submitted a Class Catch Up Form for ${slackEscape(courseName)}. Please follow up with them.`,
    `*Missed:* ${slackEscape(clip(form.missedBlocks))}`,
    `*Plan:* ${slackEscape(clip(form.makeupPlan))}`,
    `View it here: ${link}`,
  ].join('\n')
}

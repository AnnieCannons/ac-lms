// Server-side only — shared track/week/course helpers, originally built for the
// Friday instructor digest (removed) and now used by the Monday readiness-score job.

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import type { WeekRange } from '@/lib/airtable'
import { EXCLUDED_STUDENT_USER_IDS } from '@/lib/excluded-students'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

export type Track = 'backend' | 'frontend' | 'itp_tcf'

export const TRACK_CHANNELS: Record<Track, string> = {
  backend: 'C09DC5MAQ4Q',
  frontend: 'C09C551E7DM',
  itp_tcf: 'C09C56VL25D',
}

export function detectTrack(name: string, airtableCourseName: string | null): Track | null {
  const haystack = `${name} ${airtableCourseName ?? ''}`.toLowerCase()
  if (haystack.includes('backend')) return 'backend'
  if (haystack.includes('frontend')) return 'frontend'
  // ITP/TCF cohort naming is inconsistent — sometimes abbreviated ("ITP", "TCF"),
  // sometimes spelled out ("Intro to Programming", "Tech Career Foundations" /
  // "The Coding Foundation"), and airtable_course_name isn't always set.
  if (
    haystack.includes('itp') ||
    haystack.includes('tcf') ||
    haystack.includes('intro to program') ||
    haystack.includes('foundation')
  ) {
    return 'itp_tcf'
  }
  return null
}

/**
 * Extracts a trailing "(May 2026)"-style cohort tag from a course name, e.g.
 * "Intro to Programming (May 2026)" -> "may 2026". The ITP/TCF track splits
 * one cohort's attendance-taking period across two Supabase course rows (a
 * 4-week TCF phase then an 11-week ITP phase); only one of them may have
 * `airtable_course_name` set, so this tag is used to find its sibling.
 */
export function extractCohortTag(name: string): string | null {
  const m = name.match(/\(([^)]+)\)\s*$/)
  return m ? m[1].trim().toLowerCase() : null
}

export type CourseRow = {
  name: string
  is_template: boolean | null
  archived: boolean | null
  airtable_course_name: string | null
}

/**
 * Resolves the Airtable class name to use for attendance lookups. Falls back
 * to a same-track, same-cohort-tag sibling course's `airtable_course_name`
 * when this course doesn't have its own set (see extractCohortTag).
 */
export function resolveAirtableCourseName(course: CourseRow, allCourses: CourseRow[]): string | null {
  if (course.airtable_course_name) return course.airtable_course_name

  const track = detectTrack(course.name, course.airtable_course_name)
  const tag = extractCohortTag(course.name)
  if (!track || !tag) return null

  const sibling = allCourses.find(c =>
    c !== course &&
    !c.is_template &&
    !c.archived &&
    c.airtable_course_name &&
    detectTrack(c.name, c.airtable_course_name) === track &&
    extractCohortTag(c.name) === tag,
  )
  return sibling?.airtable_course_name ?? null
}

export function isCurrentCourse(startDate: string | null | undefined, endDate?: string | null): boolean {
  if (!startDate) return false
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
  const now = Date.now()
  return now >= start && now <= end
}

/** Gets the current hour (0–23) in America/New_York, DST-safe. */
export function getCurrentEtHour(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  return parseInt(parts.find(p => p.type === 'hour')!.value, 10)
}

function getEtDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Converts a timestamp (e.g. a timestamptz column read back as a Date) to its
// America/New_York calendar date, for comparing against the 'YYYY-MM-DD'
// strings getWeekRanges() returns.
export function toEtDateStr(d: Date): string {
  const { year, month, day } = getEtDateParts(d)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * "This week" / "last week" are Mon–Thu (no attendance is taken on Fridays).
 * "This week" is the Mon–Thu containing "now" (in America/New_York), so a
 * Monday-morning cron run covers the school week that just finished.
 */
export function getWeekRanges(now: Date): { thisWeek: WeekRange; lastWeek: WeekRange } {
  const { year, month, day } = getEtDateParts(now)
  const today = new Date(year, month - 1, day)
  const dow = today.getDay() // 0=Sun .. 6=Sat
  const daysSinceMonday = (dow + 6) % 7

  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysSinceMonday)
  const thisThursday = new Date(thisMonday)
  thisThursday.setDate(thisMonday.getDate() + 3)

  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastThursday = new Date(thisThursday)
  lastThursday.setDate(thisThursday.getDate() - 7)

  return {
    thisWeek: { start: formatDateStr(thisMonday), end: formatDateStr(thisThursday) },
    lastWeek: { start: formatDateStr(lastMonday), end: formatDateStr(lastThursday) },
  }
}

export type CourseStudent = { id: string; name: string; airtableStudentId: string | null }

/**
 * Enrolled students for a course. By default excludes staff/QA test accounts
 * (EXCLUDED_STUDENT_USER_IDS) -- that list exists to keep the
 * Airtable-matching script's "still unmatched" list clean, so callers outside
 * that purpose (e.g. the readiness-score job, which needs to score its own
 * dedicated test account) should pass `excludeTestAccounts: false`.
 */
export async function getCourseStudents(
  admin: AdminClient,
  courseId: string,
  opts: { excludeTestAccounts?: boolean } = {},
): Promise<CourseStudent[]> {
  const { excludeTestAccounts = true } = opts
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, users(id, name, airtable_student_id)')
    .eq('course_id', courseId)
    .eq('role', 'student')

  type EnrollmentRow = { user_id: string; users: { id: string; name: string; airtable_student_id: string | null } | null }
  return ((enrollments as unknown as EnrollmentRow[]) ?? [])
    .filter(e => e.users?.name && (!excludeTestAccounts || !EXCLUDED_STUDENT_USER_IDS.has(e.user_id)))
    .map(e => ({ id: e.user_id, name: e.users!.name, airtableStudentId: e.users!.airtable_student_id }))
}


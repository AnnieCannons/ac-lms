// Server-side only — builds the weekly attendance + assignment Slack report for instructors.

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchClassAttendanceWeekly, type WeekRange } from '@/lib/airtable'
import { computeStudentAssignmentStats } from '@/lib/student-stats-actions'

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

type Zone = 'red' | 'yellow' | 'green'

export function getZone(totalAbsences: number): Zone {
  if (totalAbsences >= 23) return 'red'
  if (totalAbsences >= 12) return 'yellow'
  return 'green'
}

function zoneLabel(zone: Zone): string {
  if (zone === 'red') return '🔴 Red'
  if (zone === 'yellow') return '🟡 Yellow'
  return '🟢 Green'
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

/**
 * "This week" / "last week" are Mon–Thu (no attendance is taken on Fridays).
 * "This week" is the Mon–Thu containing "now" (in America/New_York), so a
 * Friday-morning cron run covers the school week that just finished.
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

function dateInRange(dateStr: string, range: WeekRange): boolean {
  const d = dateStr.slice(0, 10)
  return d >= range.start && d <= range.end
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export type CourseInput = {
  id: string
  name: string
  airtableCourseName: string | null
}

export type AttendanceRow = {
  name: string
  thisWeek: number
  lastWeek: number
  total: number
  zone: Zone
}

export type AssignmentRow = {
  name: string
  thisWeek: number
  lastWeek: number
  total: number
}

export type Highlight = {
  name: string
  perfectAttendance: boolean
  perfectAssignments: boolean
}

export type CourseReport = {
  attendanceRows: AttendanceRow[]
  assignmentRows: AssignmentRow[]
  highlights: Highlight[]
}

export async function buildCourseReport(
  admin: AdminClient,
  course: CourseInput,
  weekRanges: { thisWeek: WeekRange; lastWeek: WeekRange },
): Promise<CourseReport> {
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, users(id, name)')
    .eq('course_id', course.id)
    .eq('role', 'student')

  type EnrollmentRow = { user_id: string; users: { id: string; name: string } | null }
  const students = ((enrollments as unknown as EnrollmentRow[]) ?? [])
    .filter(e => e.users?.name)
    .map(e => ({ id: e.user_id, name: e.users!.name }))

  if (students.length === 0) {
    return { attendanceRows: [], assignmentRows: [], highlights: [] }
  }

  const attendanceMap = new Map<string, Awaited<ReturnType<typeof fetchClassAttendanceWeekly>>[number]>()
  if (course.airtableCourseName) {
    try {
      const weekly = await fetchClassAttendanceWeekly(
        course.airtableCourseName,
        weekRanges.thisWeek,
        weekRanges.lastWeek,
      )
      for (const w of weekly) attendanceMap.set(normalizeName(w.preferredName), w)
    } catch (e) {
      console.warn(`weekly-report: attendance fetch failed for ${course.name}:`, e)
    }
  }

  const attendanceRows: AttendanceRow[] = []
  const assignmentRows: AssignmentRow[] = []
  const highlights: Highlight[] = []

  for (const student of students) {
    const stats = await computeStudentAssignmentStats(admin, student.id, course.id)
    const missingThisWeek = stats.missing.filter(a => a.due_date && dateInRange(a.due_date, weekRanges.thisWeek)).length
    const missingLastWeek = stats.missing.filter(a => a.due_date && dateInRange(a.due_date, weekRanges.lastWeek)).length
    const missingTotal = stats.missing.length

    const attendance = attendanceMap.get(normalizeName(student.name))

    if (attendance && attendance.absencesThisWeek > 0) {
      attendanceRows.push({
        name: student.name,
        thisWeek: attendance.absencesThisWeek,
        lastWeek: attendance.absencesLastWeek,
        total: attendance.totalAbsences,
        zone: getZone(attendance.totalAbsences),
      })
    }

    if (missingTotal >= 5) {
      assignmentRows.push({
        name: student.name,
        thisWeek: missingThisWeek,
        lastWeek: missingLastWeek,
        total: missingTotal,
      })
    }

    const perfectAttendance = !!attendance && attendance.blocksThisWeek > 0 && attendance.absencesThisWeek === 0
    const perfectAssignments = missingThisWeek === 0
    if (perfectAttendance || perfectAssignments) {
      highlights.push({ name: student.name, perfectAttendance, perfectAssignments })
    }
  }

  attendanceRows.sort((a, b) => b.total - a.total)
  assignmentRows.sort((a, b) => b.total - a.total)
  highlights.sort((a, b) => a.name.localeCompare(b.name))

  return { attendanceRows, assignmentRows, highlights }
}

export function formatReportMessage(className: string, report: CourseReport): string {
  const lines: string[] = []

  lines.push(`Here is the weekly attendance and assignment report for *${className}*:`)
  lines.push('')
  lines.push('*Attendance:*')
  if (report.attendanceRows.length === 0) {
    lines.push('No students missed class this week. 🎉')
  } else {
    for (const row of report.attendanceRows) {
      lines.push(`• *${row.name}*`)
      lines.push(`   - This week: ${row.thisWeek}`)
      lines.push(`   - Last week: ${row.lastWeek}`)
      lines.push(`   - Total absences: ${row.total}`)
      lines.push(`   - Attendance Zone: ${zoneLabel(row.zone)}`)
    }
  }

  lines.push('')
  lines.push('*Assignments:*')
  if (report.assignmentRows.length === 0) {
    lines.push('No students with 5 or more missing assignments. 🎉')
  } else {
    for (const row of report.assignmentRows) {
      lines.push(`• *${row.name}*`)
      lines.push(`   - This week: ${row.thisWeek}`)
      lines.push(`   - Last week: ${row.lastWeek}`)
      lines.push(`   - Total: ${row.total}`)
    }
  }

  lines.push('')
  lines.push('*Student Highlights*')
  if (report.highlights.length === 0) {
    lines.push('No highlights this week.')
  } else {
    for (const h of report.highlights) {
      const label = h.perfectAttendance && h.perfectAssignments
        ? 'Perfect attendance + assignments!'
        : h.perfectAttendance
          ? 'Perfect attendance!'
          : 'Perfect assignments!'
      lines.push(`• ${h.name}: ${label}`)
    }
  }

  return lines.join('\n')
}

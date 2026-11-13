// Server-side only -- scores one student for one week. The Monday job
// (runReadinessJob in readiness.ts) and the live "this week so far" preview
// both go through scoreStudentWeek, so the preview can never drift from the
// score the job will actually record.

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchClassAttendanceWeekly, fetchStudentAttendance, fetchStudentAttendanceById, type ClassStudentWeekly } from '@/lib/airtable'
import { computeStudentAssignmentStats, listNeedsRevisionEvents } from '@/lib/student-stats'
import { courseRanDuringWeek, getWeekRanges, resolveAirtableCourseName, toEtDateStr, type CourseRow } from '@/lib/weekly-report'
import { findPredecessorCourse, isEnrolledStudent } from '@/lib/readiness-chain'
import {
  buildReadinessBreakdown,
  pickPreviewWeek,
  scoredOn,
  sundayAfter,
  type ReadinessBreakdown,
  type ReadinessItem,
  type WeekRange,
} from '@/lib/readiness-breakdown'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

export type ScoringCourse = CourseRow & {
  id: string
  start_date: string | null
  end_date: string | null
  readiness_enabled: boolean | null
}

export const SCORING_COURSE_COLUMNS = 'id, name, start_date, end_date, is_template, archived, airtable_course_name, readiness_enabled'

export async function fetchScoringCourses(admin: AdminClient): Promise<ScoringCourse[]> {
  const { data } = await admin.from('courses').select(SCORING_COURSE_COLUMNS)
  return (data as ScoringCourse[] | null) ?? []
}

/**
 * True when the given Mon-Thu scoring window falls entirely inside a
 * calendar_holidays entry (e.g. Thanksgiving Week). A single-day holiday that
 * only covers the Monday (MLK Day, Labor Day, etc.) does NOT count -- classes
 * still meet the rest of that week, so it should still be scored normally.
 * We deliberately do not score a break week at all (rather than scoring it
 * and getting an all-green result) -- a quiet week with no assignments due
 * and no attendance taken would otherwise look like real progress and could
 * incorrectly count toward the 2-consecutive-good-weeks reset in the
 * escalation state machine, pulling a student out of the process for a week
 * where nothing was actually demonstrated.
 */
export async function isWeekOnFullBreak(admin: AdminClient, weekStart: string, weekEnd: string): Promise<boolean> {
  const { data } = await admin
    .from('calendar_holidays')
    .select('date, end_date')
    .lte('date', weekStart)

  return ((data as { date: string; end_date: string | null }[]) ?? []).some(
    h => (h.end_date ?? h.date) >= weekEnd,
  )
}

export type Attendance = { blocksMissed: number; blocksTotal: number }

/**
 * Scores one student for the week starting `week.start`. Missing work is
 * counted live (as of now); needs-revision returns are counted Mon-Sun, since
 * a lot of grading happens Fri-Sun and those returns belong to this week.
 * For an ITP course, the TCF predecessor's missing work and returns count too
 * (for students who were in TCF).
 */
export async function scoreStudentWeek(admin: AdminClient, args: {
  studentId: string
  courseId: string
  predecessor: { id: string; name: string } | null
  week: WeekRange
  attendance: Attendance
}): Promise<ReadinessBreakdown> {
  const { studentId, courseId, predecessor, week, attendance } = args
  const returnsWindowEnd = sundayAfter(week.start)

  const courses = [{ id: courseId, priorCourseName: null as string | null }]
  if (predecessor) courses.unshift({ id: predecessor.id, priorCourseName: predecessor.name })

  const perCourse = await Promise.all(courses.map(async c => {
    const [stats, returns] = await Promise.all([
      computeStudentAssignmentStats(admin, studentId, c.id),
      listNeedsRevisionEvents(admin, studentId, c.id, week.start, returnsWindowEnd),
    ])
    const missing: ReadinessItem[] = stats.missing.map(a => ({
      assignmentId: a.id, title: a.title, courseId: c.id, priorCourseName: c.priorCourseName, dueDate: a.due_date, returnedAt: null,
    }))
    const returned: ReadinessItem[] = returns.map(r => ({
      assignmentId: r.assignmentId, title: r.title, courseId: c.id, priorCourseName: c.priorCourseName, dueDate: r.dueDate, returnedAt: r.returnedAt,
    }))
    return { missing, returned }
  }))

  return buildReadinessBreakdown({
    blocksMissed: attendance.blocksMissed,
    blocksTotal: attendance.blocksTotal,
    missing: perCourse.flatMap(c => c.missing),
    returns: perCourse.flatMap(c => c.returned),
  })
}

/**
 * Week-scoped attendance for every Airtable student in a class, keyed by
 * airtable_student_id when known and by normalized name as a fallback for
 * enrollments not yet backfilled -- see the same pattern in buildCourseReport
 * (weekly-report.ts).
 */
export async function fetchClassWeekAttendance(
  airtableCourseName: string | null,
  week: WeekRange,
  label: string,
): Promise<(student: { name: string; airtableStudentId: string | null }) => Attendance> {
  const map = new Map<string, ClassStudentWeekly>()
  if (airtableCourseName) {
    try {
      // Same range for both slots -- only the "this week" counts are read.
      const weekly = await fetchClassAttendanceWeekly(airtableCourseName, week, week)
      for (const w of weekly) {
        if (w.airtableStudentId) map.set(w.airtableStudentId, w)
        const nameKey = w.preferredName.trim().toLowerCase()
        if (!map.has(nameKey)) map.set(nameKey, w)
      }
    } catch (e) {
      console.warn(`readiness: attendance fetch failed for ${label}:`, e)
    }
  }
  return student => {
    const w = (student.airtableStudentId && map.get(student.airtableStudentId))
      || map.get(student.name.trim().toLowerCase())
    return { blocksMissed: w?.absencesThisWeek ?? 0, blocksTotal: w?.blocksThisWeek ?? 0 }
  }
}

/** One student's attendance for a week, without pulling the whole class from Airtable. */
async function fetchOneStudentWeekAttendance(
  student: { name: string; airtableStudentId: string | null },
  airtableCourseName: string | null,
  week: WeekRange,
): Promise<Attendance> {
  try {
    const records = student.airtableStudentId
      ? await fetchStudentAttendanceById(student.airtableStudentId, week.start, week.end)
      : airtableCourseName
        ? await fetchStudentAttendance(student.name, week.start, week.end, airtableCourseName)
        : []
    let blocksMissed = 0
    let blocksTotal = 0
    for (const r of records) {
      // Same rule as fetchClassAttendanceWeekly: any filled-in block counts, "Absent" is missed.
      for (const s of [r.blockA, r.blockB, r.blockC, r.blockD]) {
        if (!s) continue
        blocksTotal++
        if (s.includes('Absent')) blocksMissed++
      }
    }
    return { blocksMissed, blocksTotal }
  } catch (e) {
    console.warn(`readiness: attendance fetch failed for student ${student.name}:`, e)
    return { blocksMissed: 0, blocksTotal: 0 }
  }
}

export type PreviewWeek = {
  start: string
  /** Thursday -- the last day of class that counts for attendance. */
  end: string
  /** Last day a needs-revision return still counts for this week. */
  returnsEnd: string
  /** The Monday this week gets its final score. */
  scoredOn: string
  /** A full break week: never scored, so there's nothing to preview. */
  onBreak: boolean
  /** The course isn't in session this week. */
  notInSession: boolean
}

/** The week the live preview shows for this course right now (see pickPreviewWeek). */
export async function resolvePreviewWeek(
  admin: AdminClient,
  course: ScoringCourse,
  chain: string[],
  now: Date,
): Promise<PreviewWeek> {
  const ranges = getWeekRanges(now)
  const { data: scored } = await admin
    .from('student_stats_snapshots')
    .select('week_start')
    .in('course_id', chain)
    .eq('week_start', ranges.lastWeek.start)
    .limit(1)
  const week = pickPreviewWeek(ranges, toEtDateStr(now), !!(scored && scored.length > 0))
  return {
    start: week.start,
    end: week.end,
    returnsEnd: sundayAfter(week.start),
    scoredOn: scoredOn(week.start),
    onBreak: await isWeekOnFullBreak(admin, week.start, week.end),
    notInSession: !courseRanDuringWeek(course.start_date, course.end_date, week),
  }
}

export type StudentReadinessPreview = { week: PreviewWeek; breakdown: ReadinessBreakdown | null }

/** Live "this week so far" score for one student in one course -- null when the course doesn't use readiness. */
export async function getStudentReadinessPreview(
  admin: AdminClient,
  student: { id: string; name: string; airtableStudentId: string | null },
  courseId: string,
  now: Date,
): Promise<StudentReadinessPreview | null> {
  const allCourses = await fetchScoringCourses(admin)
  const course = allCourses.find(c => c.id === courseId)
  if (!course?.readiness_enabled) return null
  const predecessor = findPredecessorCourse(course, allCourses)
  const chain = predecessor ? [predecessor.id, course.id] : [course.id]

  const week = await resolvePreviewWeek(admin, course, chain, now)
  if (week.onBreak || week.notInSession) return { week, breakdown: null }

  const attendance = await fetchOneStudentWeekAttendance(student, resolveAirtableCourseName(course, allCourses), week)
  const breakdown = await scoreStudentWeek(admin, {
    studentId: student.id,
    courseId,
    predecessor: predecessor && (await isEnrolledStudent(admin, student.id, predecessor.id)) ? predecessor : null,
    week,
    attendance,
  })
  return { week, breakdown }
}

/** Live "this week so far" scores for a list of students in one course, keyed by student id. */
export async function getClassReadinessPreview(
  admin: AdminClient,
  courseId: string,
  students: { id: string; name: string; airtableStudentId: string | null }[],
  now: Date,
): Promise<{ week: PreviewWeek; byStudent: Map<string, ReadinessBreakdown> } | null> {
  const allCourses = await fetchScoringCourses(admin)
  const course = allCourses.find(c => c.id === courseId)
  if (!course) return null
  const predecessor = findPredecessorCourse(course, allCourses)
  const chain = predecessor ? [predecessor.id, course.id] : [course.id]

  const week = await resolvePreviewWeek(admin, course, chain, now)
  const byStudent = new Map<string, ReadinessBreakdown>()
  if (week.onBreak || week.notInSession) return { week, byStudent }

  const [attendanceFor, predecessorIds] = await Promise.all([
    fetchClassWeekAttendance(resolveAirtableCourseName(course, allCourses), week, course.name),
    predecessor ? predecessorStudentIds(admin, predecessor.id) : Promise.resolve(new Set<string>()),
  ])

  // A few at a time -- each student is a handful of queries.
  const BATCH = 6
  for (let i = 0; i < students.length; i += BATCH) {
    await Promise.all(students.slice(i, i + BATCH).map(async s => {
      byStudent.set(s.id, await scoreStudentWeek(admin, {
        studentId: s.id,
        courseId,
        predecessor: predecessor && predecessorIds.has(s.id) ? predecessor : null,
        week,
        attendance: attendanceFor(s),
      }))
    }))
  }
  return { week, byStudent }
}

export async function predecessorStudentIds(admin: AdminClient, predecessorId: string): Promise<Set<string>> {
  const { data } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', predecessorId)
    .eq('role', 'student')
  return new Set(((data as { user_id: string }[] | null) ?? []).map(r => r.user_id))
}

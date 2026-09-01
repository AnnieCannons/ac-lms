'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getStudentAssignmentStats,
  getStudentStatsHistory,
  type StudentAssignmentStats,
  type StatsHistoryPoint,
} from '@/lib/student-stats-actions'
import { TrendChart, ZoneBadge, StatCard, AssignmentList } from '@/components/ui/StudentStatsWidgets'
import UserAvatar from '@/components/ui/UserAvatar'
import type { CourseWithStudents } from '@/app/instructor/students/page'

type AttendanceStats = {
  absences: number
  tardies: number
  totalBlocks: number
  percentMissed: number | null
}

type StudentData = {
  assignments: StudentAssignmentStats | null
  attendance: AttendanceStats | null
  history: StatsHistoryPoint[] | null
  loading: boolean
  error: string | null
  activeBucket: 'complete' | 'waiting-to-be-graded' | 'needs-revision' | 'missing' | 'due-this-week' | 'excused' | null
}

function StudentRow({
  student,
  courseId,
  startDate,
  endDate,
  airtableCourseName,
}: {
  student: { id: string; name: string; avatarUrl: string | null; airtableStudentId: string | null }
  courseId: string
  startDate: string | null
  endDate: string | null
  airtableCourseName: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState<StudentData>({
    assignments: null,
    attendance: null,
    history: null,
    loading: false,
    error: null,
    activeBucket: null,
  })

  const load = useCallback(async () => {
    if (data.assignments !== null || data.loading) return
    setData(d => ({ ...d, loading: true, error: null }))
    try {
      // Prefer the stable airtable_student_id — safe even if this student's display
      // name collides with someone else's. Fall back to name for students without one yet.
      const attendanceParams = new URLSearchParams(
        student.airtableStudentId ? { id: student.airtableStudentId } : { name: student.name },
      )
      if (startDate) attendanceParams.set('since', startDate)
      if (endDate) attendanceParams.set('until', endDate)
      if (airtableCourseName) attendanceParams.set('courseName', airtableCourseName)
      const [assignments, attendanceRes, history] = await Promise.all([
        getStudentAssignmentStats(student.id, courseId),
        fetch(`/api/attendance/instructor/student?${attendanceParams}`).then(r => r.json()),
        getStudentStatsHistory(student.id, courseId).catch(() => []),
      ])
      setData(d => ({
        ...d,
        assignments,
        attendance: attendanceRes.error ? null : attendanceRes,
        history,
        loading: false,
      }))
    } catch {
      setData(d => ({ ...d, loading: false, error: 'Failed to load data.' }))
    }
  }, [data.assignments, data.loading, student.id, student.name, student.airtableStudentId, courseId, startDate, endDate, airtableCourseName])

  const toggle = () => {
    if (!expanded) load()
    setExpanded(v => !v)
  }

  const setBucket = (bucket: typeof data.activeBucket) => {
    setData(d => ({ ...d, activeBucket: d.activeBucket === bucket ? null : bucket }))
  }

  const a = data.assignments

  return (
    <li className="border-b border-border last:border-0">
      <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-background transition-colors">
        <button type="button" onClick={toggle} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <UserAvatar name={student.name} avatarUrl={student.avatarUrl} size="md" />
          <span className="text-sm font-medium text-dark-text truncate">{student.name}</span>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/instructor/students/${student.id}`}
            className="text-xs text-teal-primary hover:underline"
          >
            View full profile
          </Link>
          <button type="button" onClick={toggle} aria-label={expanded ? 'Collapse details' : 'Expand details'}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 text-muted-text transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-5 space-y-5">
          {data.loading && <p className="text-sm text-muted-text">Loading…</p>}
          {data.error && <p className="text-sm text-red-600">{data.error}</p>}

          {a && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wider">Assignments</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <StatCard
                  label="Complete"
                  count={a.complete.length}
                  active={data.activeBucket === 'complete'}
                  onClick={() => setBucket('complete')}
                  color="status-complete-card"
                />
                <StatCard
                  label="Waiting to be graded"
                  count={a.waitingToBeGraded.length}
                  active={data.activeBucket === 'waiting-to-be-graded'}
                  onClick={() => setBucket('waiting-to-be-graded')}
                  color="status-grading-card"
                />
                <StatCard
                  label="Needs Revision"
                  count={a.needsRevision.length}
                  active={data.activeBucket === 'needs-revision'}
                  onClick={() => setBucket('needs-revision')}
                  color="status-revision-card"
                />
                <StatCard
                  label="Missing"
                  count={a.missing.length}
                  active={data.activeBucket === 'missing'}
                  onClick={() => setBucket('missing')}
                  color="status-missing-card"
                />
                <StatCard
                  label="Due this week"
                  count={a.dueThisWeek.length}
                  active={data.activeBucket === 'due-this-week'}
                  onClick={() => setBucket('due-this-week')}
                  color="bg-surface text-dark-text border-muted-text"
                />
                <StatCard
                  label="Excused"
                  count={a.excused.length}
                  active={data.activeBucket === 'excused'}
                  onClick={() => setBucket('excused')}
                  color="status-late-card"
                />
              </div>

              {data.activeBucket === 'complete' && (
                <AssignmentList assignments={a.complete} courseId={courseId} studentId={student.id} label="Complete" />
              )}
              {data.activeBucket === 'waiting-to-be-graded' && (
                <AssignmentList assignments={a.waitingToBeGraded} courseId={courseId} studentId={student.id} label="Waiting to be graded" />
              )}
              {data.activeBucket === 'needs-revision' && (
                <AssignmentList assignments={a.needsRevision} courseId={courseId} studentId={student.id} label="Needs Revision" />
              )}
              {data.activeBucket === 'missing' && (
                <AssignmentList assignments={a.missing} courseId={courseId} studentId={student.id} label="Missing" />
              )}
              {data.activeBucket === 'due-this-week' && (
                <AssignmentList assignments={a.dueThisWeek} courseId={courseId} studentId={student.id} label="Due this week" />
              )}
              {data.activeBucket === 'excused' && (
                <AssignmentList assignments={a.excused} courseId={courseId} studentId={student.id} label="Excused" />
              )}
            </div>
          )}

          {data.history && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wider">Trend</p>
              <TrendChart history={data.history} />
            </div>
          )}

          {data.attendance && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wider">Attendance</p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-text">Absences:</span>
                  <span className="text-sm font-semibold text-dark-text">{data.attendance.absences}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-text">Tardies:</span>
                  <span className="text-sm font-semibold text-dark-text">{data.attendance.tardies}</span>
                </div>
                {data.attendance.percentMissed !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-text">% Missed:</span>
                    <span className="text-sm font-semibold text-dark-text">{Math.round(data.attendance.percentMissed)}%</span>
                  </div>
                )}
                <ZoneBadge absences={data.attendance.absences} />
              </div>
            </div>
          )}

          {!data.loading && !data.error && !data.attendance && a && (
            <p className="text-xs text-muted-text">No attendance data found for {student.name}.</p>
          )}
        </div>
      )}
    </li>
  )
}

function CourseAccordion({ course }: { course: CourseWithStudents }) {
  const { startDate, endDate, airtableCourseName } = course
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-background transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-semibold text-dark-text truncate">{course.name}</span>
          <span className="text-xs text-muted-text shrink-0">{course.students.length} student{course.students.length !== 1 ? 's' : ''}</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-muted-text shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className="border-t border-border divide-y divide-border">
          {course.students.map(s => (
            <StudentRow key={s.id} student={s} courseId={course.id} startDate={startDate} endDate={endDate} airtableCourseName={airtableCourseName} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function StudentsDashboard({ courses }: { courses: CourseWithStudents[] }) {
  if (courses.length === 0) {
    return <p className="text-muted-text">No students found.</p>
  }

  return (
    <div className="space-y-5">
      {courses.map(course => (
        <CourseAccordion key={course.id} course={course} />
      ))}
    </div>
  )
}

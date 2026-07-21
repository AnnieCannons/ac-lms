'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { getStudentAssignmentStats, type StudentAssignmentStats, type AssignmentStat } from '@/lib/student-stats-actions'
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
  loading: boolean
  error: string | null
  activeBucket: 'complete' | 'turned-in' | 'missing' | 'not-started' | null
}

function ZoneBadge({ absences }: { absences: number }) {
  if (absences >= 23) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-200 text-red-900">Red zone</span>
  if (absences >= 12) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900">Yellow zone</span>
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Green zone</span>
}

function StatCard({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all text-left ${
        active
          ? `${color} border-current shadow-sm`
          : 'bg-background border-border hover:border-muted-text'
      }`}
    >
      <span className={`text-2xl font-bold ${active ? '' : 'text-dark-text'}`}>{count}</span>
      <span className={`text-xs font-medium ${active ? '' : 'text-muted-text'}`}>{label}</span>
    </button>
  )
}

function AssignmentList({
  assignments,
  courseId,
  label,
}: {
  assignments: AssignmentStat[]
  courseId: string
  label: string
}) {
  if (assignments.length === 0) {
    return <p className="text-sm text-muted-text py-2">No {label.toLowerCase()} assignments.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {assignments.map(a => (
        <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-surface hover:bg-background transition-colors">
          <div className="min-w-0">
            <Link
              href={`/instructor/courses/${courseId}/assignments/${a.id}`}
              className="text-sm font-medium text-teal-primary hover:underline truncate block"
            >
              {a.title}
            </Link>
            {a.module_title && (
              <span className="text-xs text-muted-text">{a.module_title}</span>
            )}
          </div>
          {a.due_date && (
            <span className="text-xs text-muted-text shrink-0">
              Due {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function StudentRow({
  student,
  courseId,
  startDate,
  endDate,
  airtableCourseName,
}: {
  student: { id: string; name: string }
  courseId: string
  startDate: string | null
  endDate: string | null
  airtableCourseName: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState<StudentData>({
    assignments: null,
    attendance: null,
    loading: false,
    error: null,
    activeBucket: null,
  })

  const load = useCallback(async () => {
    if (data.assignments !== null || data.loading) return
    setData(d => ({ ...d, loading: true, error: null }))
    try {
      const attendanceParams = new URLSearchParams({ name: student.name })
      if (startDate) attendanceParams.set('since', startDate)
      if (endDate) attendanceParams.set('until', endDate)
      if (airtableCourseName) attendanceParams.set('courseName', airtableCourseName)
      const [assignments, attendanceRes] = await Promise.all([
        getStudentAssignmentStats(student.id, courseId),
        fetch(`/api/attendance/instructor/student?${attendanceParams}`).then(r => r.json()),
      ])
      setData(d => ({
        ...d,
        assignments,
        attendance: attendanceRes.error ? null : attendanceRes,
        loading: false,
      }))
    } catch {
      setData(d => ({ ...d, loading: false, error: 'Failed to load data.' }))
    }
  }, [data.assignments, data.loading, student.id, student.name, courseId, startDate, endDate, airtableCourseName])

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
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-background transition-colors text-left"
      >
        <span className="text-sm font-medium text-dark-text">{student.name}</span>
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

      {expanded && (
        <div className="px-4 pb-5 space-y-5">
          {data.loading && <p className="text-sm text-muted-text">Loading…</p>}
          {data.error && <p className="text-sm text-red-600">{data.error}</p>}

          {a && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wider">Assignments</p>
              <div className="grid grid-cols-4 gap-2">
                <StatCard
                  label="Complete"
                  count={a.complete.length}
                  active={data.activeBucket === 'complete'}
                  onClick={() => setBucket('complete')}
                  color="status-complete-card"
                />
                <StatCard
                  label="Turned In"
                  count={a.turnedIn.length}
                  active={data.activeBucket === 'turned-in'}
                  onClick={() => setBucket('turned-in')}
                  color="bg-teal-light text-teal-primary border-teal-primary"
                />
                <StatCard
                  label="Missing"
                  count={a.missing.length}
                  active={data.activeBucket === 'missing'}
                  onClick={() => setBucket('missing')}
                  color="status-missing-card"
                />
                <StatCard
                  label="Not Started"
                  count={a.notStarted.length}
                  active={data.activeBucket === 'not-started'}
                  onClick={() => setBucket('not-started')}
                  color="bg-surface text-dark-text border-muted-text"
                />
              </div>

              {data.activeBucket === 'complete' && (
                <AssignmentList assignments={a.complete} courseId={courseId} label="Complete" />
              )}
              {data.activeBucket === 'turned-in' && (
                <AssignmentList assignments={a.turnedIn} courseId={courseId} label="Turned In" />
              )}
              {data.activeBucket === 'missing' && (
                <AssignmentList assignments={a.missing} courseId={courseId} label="Missing" />
              )}
              {data.activeBucket === 'not-started' && (
                <AssignmentList assignments={a.notStarted} courseId={courseId} label="Not Started" />
              )}
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
  const [open, setOpen] = useState(true)

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
    return <p className="text-muted-text">No students in current courses.</p>
  }

  return (
    <div className="space-y-5">
      {courses.map(course => (
        <CourseAccordion key={course.id} course={course} />
      ))}
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts'
import {
  getStudentAssignmentStats,
  getStudentStatsHistory,
  type StudentAssignmentStats,
  type AssignmentStat,
  type StatsHistoryPoint,
} from '@/lib/student-stats-actions'
import { getSubmissionComments, type SubmissionCommentPreview } from '@/lib/grade-actions'
import MarkdownContent from '@/components/ui/MarkdownContent'
import LocalDateTime from '@/components/ui/LocalDateTime'
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

const MISSING_COLOR = '#dc2626'
const NEEDS_REVISION_COLOR = '#ea580c'

function formatWeekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TrendChart({ history }: { history: StatsHistoryPoint[] }) {
  if (history.length < 2) {
    return <p className="text-sm text-muted-text py-2">Trend appears after a couple weeks of data.</p>
  }

  const data = history.map(h => ({ week: formatWeekLabel(h.weekStart), missing: h.missing, needsRevision: h.needsRevision }))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: MISSING_COLOR }} />
          Missing
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: NEEDS_REVISION_COLOR }} />
          Needs Revision
        </span>
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis domain={[0, 'dataMax']} hide />
          <Tooltip
            labelFormatter={(label) => `Week of ${label}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey="missing"
            name="Missing"
            stroke={MISSING_COLOR}
            strokeWidth={2}
            dot={data.length <= 8 ? { r: 2, fill: MISSING_COLOR, strokeWidth: 0 } : false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="needsRevision"
            name="Needs Revision"
            stroke={NEEDS_REVISION_COLOR}
            strokeWidth={2}
            dot={data.length <= 8 ? { r: 2, fill: NEEDS_REVISION_COLOR, strokeWidth: 0 } : false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
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

function CommentsPreview({ submissionId, courseId }: { submissionId: string; courseId: string }) {
  const [comments, setComments] = useState<SubmissionCommentPreview[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSubmissionComments(submissionId, courseId)
      .then(result => { if (!cancelled) setComments(result) })
      .catch(() => { if (!cancelled) setError('Could not load comments.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [submissionId, courseId])

  if (loading) return <p className="text-xs text-muted-text px-4 pb-3">Loading comments…</p>
  if (error) return <p className="text-xs text-red-600 px-4 pb-3">{error}</p>
  if (!comments || comments.length === 0) return <p className="text-xs text-muted-text italic px-4 pb-3">No comments.</p>

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {comments.map(c => (
        <div key={c.id} className="text-xs bg-background rounded-lg border border-border p-2.5">
          <p className="font-semibold text-dark-text">
            {c.author_name} <span className="font-normal text-muted-text">· {c.author_role}</span>
            <span className="font-normal text-muted-text"> · <LocalDateTime iso={c.created_at} /></span>
          </p>
          <div className="mt-0.5">
            <MarkdownContent content={c.content} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AssignmentRow({ a, courseId, studentId }: { a: AssignmentStat; courseId: string; studentId: string }) {
  const [showComments, setShowComments] = useState(false)

  return (
    <li className="bg-surface hover:bg-background transition-colors">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions/${studentId}?by=student`}
            className="text-sm font-medium text-teal-primary hover:underline truncate block"
          >
            {a.title}
          </Link>
          {a.module_title && (
            <span className="text-xs text-muted-text">{a.module_title}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {a.comment_count > 0 && (
            <button
              type="button"
              onClick={() => setShowComments(v => !v)}
              className="flex items-center gap-1 text-xs text-teal-primary hover:underline"
            >
              {a.comment_count} comment{a.comment_count === 1 ? '' : 's'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-3 h-3 transition-transform ${showComments ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          {a.due_date && (
            <span className="text-xs text-muted-text">
              Due {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      {showComments && a.submission_id && (
        <CommentsPreview submissionId={a.submission_id} courseId={courseId} />
      )}
    </li>
  )
}

function AssignmentList({
  assignments,
  courseId,
  studentId,
  label,
}: {
  assignments: AssignmentStat[]
  courseId: string
  studentId: string
  label: string
}) {
  if (assignments.length === 0) {
    return <p className="text-sm text-muted-text py-2">No {label.toLowerCase()} assignments.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {assignments.map(a => (
        <AssignmentRow key={a.id} a={a} courseId={courseId} studentId={studentId} />
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
    history: null,
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

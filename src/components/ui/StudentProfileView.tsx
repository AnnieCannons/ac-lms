'use client'

import { useEffect, useState } from 'react'
import {
  getStudentAssignmentStats,
  getStudentStatsHistory,
  type StudentAssignmentStats,
  type StatsHistoryPoint,
} from '@/lib/student-stats-actions'
import { StatCard, TrendChart, ZoneBadge, AssignmentList, AttendanceTrendChart, type AttendanceHistoryPoint } from '@/components/ui/StudentStatsWidgets'

export type ProfileCourse = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  airtableCourseName: string | null
  isCurrent: boolean
}

type AttendanceStats = {
  absences: number
  tardies: number
  totalBlocks: number
  percentMissed: number | null
  history: AttendanceHistoryPoint[]
}

type Bucket = 'complete' | 'waiting-to-be-graded' | 'needs-revision' | 'missing' | 'due-this-week' | 'excused' | null

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-5 space-y-2">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wider">{title}</p>
      <p className="text-sm text-muted-text italic">{description}</p>
    </div>
  )
}

export default function StudentProfileView({
  student,
  courses,
}: {
  student: { id: string; name: string; email: string }
  courses: ProfileCourse[]
}) {
  const currentCourse = courses.find(c => c.isCurrent) ?? null
  const pastCourses = courses.filter(c => !c.isCurrent)

  const [assignments, setAssignments] = useState<StudentAssignmentStats | null>(null)
  const [history, setHistory] = useState<StatsHistoryPoint[] | null>(null)
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(!!currentCourse)
  const [error, setError] = useState<string | null>(null)
  const [activeBucket, setActiveBucket] = useState<Bucket>(null)

  useEffect(() => {
    if (!currentCourse) return
    let cancelled = false

    const attendanceParams = new URLSearchParams({ name: student.name })
    if (currentCourse.startDate) attendanceParams.set('since', currentCourse.startDate)
    if (currentCourse.endDate) attendanceParams.set('until', currentCourse.endDate)
    if (currentCourse.airtableCourseName) attendanceParams.set('courseName', currentCourse.airtableCourseName)

    Promise.all([
      getStudentAssignmentStats(student.id, currentCourse.id),
      fetch(`/api/attendance/instructor/student?${attendanceParams}`).then(r => r.json()),
      getStudentStatsHistory(student.id, currentCourse.id).catch(() => []),
    ])
      .then(([a, attendanceRes, h]) => {
        if (cancelled) return
        setAssignments(a)
        setAttendance(attendanceRes.error ? null : attendanceRes)
        setHistory(h)
      })
      .catch(() => { if (!cancelled) setError('Failed to load data.') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [currentCourse, student.id, student.name])

  const setBucket = (bucket: Bucket) => setActiveBucket(b => (b === bucket ? null : bucket))

  return (
    <div className="space-y-6">
      {courses.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {courses.map(c => (
            <span
              key={c.id}
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                c.isCurrent ? 'bg-teal-light text-teal-primary' : 'bg-background text-muted-text border border-border'
              }`}
            >
              {c.name}
            </span>
          ))}
        </div>
      )}

      {!currentCourse && (
        <p className="text-sm text-muted-text">No current course enrollment found for {student.name}.</p>
      )}

      {currentCourse && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card title="Attendance">
              {loading && <p className="text-sm text-muted-text">Loading…</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!loading && !error && attendance && (
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-text">Absences:</span>
                    <span className="text-sm font-semibold text-dark-text">{attendance.absences}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-text">Tardies:</span>
                    <span className="text-sm font-semibold text-dark-text">{attendance.tardies}</span>
                  </div>
                  {attendance.percentMissed !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-text">% Missed:</span>
                      <span className="text-sm font-semibold text-dark-text">{Math.round(attendance.percentMissed)}%</span>
                    </div>
                  )}
                  <ZoneBadge absences={attendance.absences} />
                </div>
              )}
              {!loading && !error && attendance && (
                <AttendanceTrendChart history={attendance.history} />
              )}
              {!loading && !error && !attendance && (
                <p className="text-sm text-muted-text">No attendance data found for {student.name}.</p>
              )}
              {pastCourses.length > 0 && (
                <p className="text-xs text-muted-text italic">Past course attendance history coming soon.</p>
              )}
            </Card>

            <Card title="Assignments">
              {loading && <p className="text-sm text-muted-text">Loading…</p>}
              {!loading && assignments && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <StatCard label="Complete" count={assignments.complete.length} active={activeBucket === 'complete'} onClick={() => setBucket('complete')} color="status-complete-card" />
                    <StatCard label="Waiting to be graded" count={assignments.waitingToBeGraded.length} active={activeBucket === 'waiting-to-be-graded'} onClick={() => setBucket('waiting-to-be-graded')} color="status-grading-card" />
                    <StatCard label="Needs Revision" count={assignments.needsRevision.length} active={activeBucket === 'needs-revision'} onClick={() => setBucket('needs-revision')} color="status-revision-card" />
                    <StatCard label="Missing" count={assignments.missing.length} active={activeBucket === 'missing'} onClick={() => setBucket('missing')} color="status-missing-card" />
                    <StatCard label="Due this week" count={assignments.dueThisWeek.length} active={activeBucket === 'due-this-week'} onClick={() => setBucket('due-this-week')} color="bg-surface text-dark-text border-muted-text" />
                    <StatCard label="Excused" count={assignments.excused.length} active={activeBucket === 'excused'} onClick={() => setBucket('excused')} color="status-late-card" />
                  </div>
                  {activeBucket === 'complete' && <AssignmentList assignments={assignments.complete} courseId={currentCourse.id} studentId={student.id} label="Complete" />}
                  {activeBucket === 'waiting-to-be-graded' && <AssignmentList assignments={assignments.waitingToBeGraded} courseId={currentCourse.id} studentId={student.id} label="Waiting to be graded" />}
                  {activeBucket === 'needs-revision' && <AssignmentList assignments={assignments.needsRevision} courseId={currentCourse.id} studentId={student.id} label="Needs Revision" />}
                  {activeBucket === 'missing' && <AssignmentList assignments={assignments.missing} courseId={currentCourse.id} studentId={student.id} label="Missing" />}
                  {activeBucket === 'due-this-week' && <AssignmentList assignments={assignments.dueThisWeek} courseId={currentCourse.id} studentId={student.id} label="Due this week" />}
                  {activeBucket === 'excused' && <AssignmentList assignments={assignments.excused} courseId={currentCourse.id} studentId={student.id} label="Excused" />}
                </>
              )}
            </Card>
          </div>

          <Card title="Trend">
            {history && <TrendChart history={history} />}
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <PlaceholderCard title="Student Monitors" description="Will show monitors pulled in from Airtable." />
        <PlaceholderCard title="PIPs" description="Linked performance improvement plans will appear here." />
        <PlaceholderCard title="Student Goals" description="Goals forms the student has written will appear here." />
      </div>
    </div>
  )
}

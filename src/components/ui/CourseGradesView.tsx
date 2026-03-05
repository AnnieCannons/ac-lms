'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Assignment {
  id: string
  title: string
  due_date: string | null
  moduleTitle: string
}

interface Module {
  id: string
  title: string
  week_number: number | null
}

interface Student {
  id: string
  name: string
}

interface Sub {
  assignment_id: string
  student_id: string
  status: string
  grade: string | null
}

interface AssignmentStats {
  turnedIn: number
  needsGrading: number
  complete: number
  incomplete: number
}

interface StudentRow {
  student: Student
  submitted: number
  missing: Assignment[]
  needsGrading: Assignment[]
  complete: Assignment[]
  incomplete: Assignment[]
}

type ExpandKey = 'missing' | 'needsGrading' | 'complete' | 'incomplete'

interface Props {
  courseId: string
  modules: Module[]
  assignments: Assignment[]
  students: Student[]
  statsByAssignment: Record<string, AssignmentStats>
  submissions: Sub[]
  totalStudents: number
  totalNeedsGrading: number
}

export default function CourseGradesView({
  courseId,
  modules,
  assignments,
  students,
  statsByAssignment,
  submissions,
  totalStudents,
  totalNeedsGrading,
}: Props) {
  const [tab, setTab] = useState<'assignments' | 'students'>('assignments')
  const [filterUngraded, setFilterUngraded] = useState(false)

  const now = new Date()
  const subMap = new Map(submissions.map(s => [`${s.student_id}-${s.assignment_id}`, s]))

  const studentStats: StudentRow[] = students
    .map(student => {
      const missing: Assignment[] = []
      const needsGrading: Assignment[] = []
      const complete: Assignment[] = []
      const incomplete: Assignment[] = []
      let submitted = 0

      for (const a of assignments) {
        const sub = subMap.get(`${student.id}-${a.id}`)
        if (!sub || sub.status === 'draft') {
          if (a.due_date && new Date(a.due_date) < now) missing.push(a)
        } else if (sub.status === 'submitted') {
          submitted++
          needsGrading.push(a)
        } else if (sub.status === 'graded') {
          submitted++
          if (sub.grade === 'complete') complete.push(a)
          else if (sub.grade === 'incomplete') incomplete.push(a)
        }
      }

      return { student, submitted, missing, needsGrading, complete, incomplete }
    })
    .sort((a, b) => {
      const aAttn = a.missing.length + a.needsGrading.length + a.incomplete.length
      const bAttn = b.missing.length + b.needsGrading.length + b.incomplete.length
      return bAttn - aAttn || a.student.name.localeCompare(b.student.name)
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 bg-border/20 rounded-xl">
          <button
            onClick={() => setTab('assignments')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'assignments' ? 'bg-surface text-dark-text shadow-sm' : 'text-muted-text hover:text-dark-text'
            }`}
          >
            By Assignment
          </button>
          <button
            onClick={() => setTab('students')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'students' ? 'bg-surface text-dark-text shadow-sm' : 'text-muted-text hover:text-dark-text'
            }`}
          >
            By Student
          </button>
        </div>
        {totalNeedsGrading > 0 && (
          <button
            onClick={() => { setTab('assignments'); setFilterUngraded(true) }}
            className="text-sm font-semibold px-4 py-2 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
          >
            {totalNeedsGrading} need grading
          </button>
        )}
      </div>

      {tab === 'assignments' ? (
        <AssignmentsTab
          courseId={courseId}
          modules={modules}
          assignments={assignments}
          statsByAssignment={statsByAssignment}
          totalStudents={totalStudents}
          filterUngraded={filterUngraded}
          onClearFilter={() => setFilterUngraded(false)}
        />
      ) : (
        <StudentsTab
          studentStats={studentStats}
          totalAssignments={assignments.length}
          courseId={courseId}
        />
      )}
    </div>
  )
}

function AssignmentsTab({
  courseId,
  modules,
  assignments,
  statsByAssignment,
  totalStudents,
  filterUngraded,
  onClearFilter,
}: {
  courseId: string
  modules: Module[]
  assignments: Assignment[]
  statsByAssignment: Record<string, AssignmentStats>
  totalStudents: number
  filterUngraded: boolean
  onClearFilter: () => void
}) {
  if (assignments.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text">No assignments in this course yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {filterUngraded && (
        <div className="flex items-center gap-2 px-1 mb-1">
          <span className="text-xs font-medium text-yellow-600">Showing assignments that need grading</span>
          <button
            onClick={onClearFilter}
            className="text-xs text-muted-text hover:text-dark-text transition-colors"
          >
            × Clear
          </button>
        </div>
      )}
      {modules.map(m => {
        const moduleAssignments = assignments.filter(a => {
          if (a.moduleTitle !== m.title) return false
          if (filterUngraded && !((statsByAssignment[a.id]?.needsGrading ?? 0) > 0)) return false
          return true
        })
        if (moduleAssignments.length === 0) return null
        return (
          <div key={m.id}>
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1 py-2">
              {m.title}{m.week_number ? ` · Week ${m.week_number}` : ''}
            </p>
            <div className="flex flex-col divide-y divide-border border border-border rounded-2xl overflow-hidden">
              {moduleAssignments.map(a => {
                const stats = statsByAssignment[a.id]
                const hasUngraded = (stats?.needsGrading ?? 0) > 0
                return (
                  <div key={a.id} className="bg-surface px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-dark-text">{a.title}</span>
                        {hasUngraded && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">
                            {stats.needsGrading} ungraded
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-text flex-wrap">
                        {a.due_date && (
                          <span>
                            Due {new Date(a.due_date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        )}
                        {stats ? (
                          <>
                            <span>{stats.turnedIn}/{totalStudents} turned in</span>
                            {stats.complete > 0 && <span className="text-teal-primary">{stats.complete} complete</span>}
                            {stats.incomplete > 0 && <span className="text-red-500">{stats.incomplete} incomplete</span>}
                          </>
                        ) : (
                          <span>0/{totalStudents} turned in</span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions`}
                      className="shrink-0 text-xs font-semibold text-teal-primary hover:underline"
                    >
                      Grade →
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StudentsTab({
  studentStats,
  totalAssignments,
  courseId,
}: {
  studentStats: StudentRow[]
  totalAssignments: number
  courseId: string
}) {
  const [expanded, setExpanded] = useState<{ studentId: string; category: ExpandKey } | null>(null)

  if (studentStats.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text">No students enrolled.</p>
      </div>
    )
  }

  const toggle = (studentId: string, category: ExpandKey) => {
    setExpanded(prev =>
      prev?.studentId === studentId && prev.category === category ? null : { studentId, category }
    )
  }

  return (
    <div className="flex flex-col divide-y divide-border border border-border rounded-2xl overflow-hidden">
      {studentStats.map(({ student, submitted, missing, needsGrading, complete, incomplete }) => {
        const isExpanded = (cat: ExpandKey) =>
          expanded?.studentId === student.id && expanded.category === cat

        const expandedList: Assignment[] =
          expanded?.studentId === student.id
            ? { missing, needsGrading, complete, incomplete }[expanded.category] ?? []
            : []

        return (
          <div key={student.id} className="bg-surface">
            <div className="px-6 py-4">
              <p className="text-sm font-semibold text-dark-text mb-1.5">{student.name}</p>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                <span className="text-muted-text">{submitted}/{totalAssignments} submitted</span>

                {missing.length > 0 && (
                  <button
                    onClick={() => toggle(student.id, 'missing')}
                    className={`font-medium transition-colors ${isExpanded('missing') ? 'text-red-700 underline' : 'text-red-500 hover:underline'}`}
                  >
                    {missing.length} missing
                  </button>
                )}
                {needsGrading.length > 0 && (
                  <button
                    onClick={() => toggle(student.id, 'needsGrading')}
                    className={`font-medium transition-colors ${isExpanded('needsGrading') ? 'text-yellow-700 underline' : 'text-yellow-600 hover:underline'}`}
                  >
                    {needsGrading.length} needs grading
                  </button>
                )}
                {incomplete.length > 0 && (
                  <button
                    onClick={() => toggle(student.id, 'incomplete')}
                    className={`font-medium transition-colors ${isExpanded('incomplete') ? 'text-red-600 underline' : 'text-red-400 hover:underline'}`}
                  >
                    {incomplete.length} incomplete
                  </button>
                )}
                {complete.length > 0 && (
                  <button
                    onClick={() => toggle(student.id, 'complete')}
                    className={`font-medium transition-colors ${isExpanded('complete') ? 'text-teal-700 underline' : 'text-teal-primary hover:underline'}`}
                  >
                    {complete.length} complete
                  </button>
                )}
              </div>
            </div>

            {expanded?.studentId === student.id && expandedList.length > 0 && (
              <div className="border-t border-border bg-background px-6 py-3 flex flex-col gap-1">
                {expandedList.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-xs text-dark-text">{a.title}</span>
                    {expanded.category !== 'missing' ? (
                      <Link
                        href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions/${student.id}`}
                        className="text-xs font-medium text-teal-primary hover:underline shrink-0"
                      >
                        {expanded.category === 'needsGrading' ? 'Grade →' : 'View →'}
                      </Link>
                    ) : (
                      <Link
                        href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions`}
                        className="text-xs text-muted-text hover:text-teal-primary shrink-0"
                      >
                        View class →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

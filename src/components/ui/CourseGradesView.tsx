'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDueDate, localDate } from '@/lib/date-utils'
import { saveGrade } from '@/lib/grade-actions'

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
  id: string
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
  late: Assignment[]
  needsReview: Assignment[]
  complete: Assignment[]
  incomplete: Assignment[]
}

type ExpandKey = 'late' | 'needsReview' | 'complete' | 'incomplete'

interface Props {
  courseId: string
  instructorId: string
  initialTab?: 'assignments' | 'students'
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
  instructorId,
  initialTab = 'assignments',
  modules,
  assignments,
  students,
  statsByAssignment,
  submissions,
  totalStudents,
  totalNeedsGrading,
}: Props) {
  const [tab, setTab] = useState<'assignments' | 'students'>(initialTab)
  const [filterUngraded, setFilterUngraded] = useState(false)
  const [speedGraderOpen, setSpeedGraderOpen] = useState(false)
  const [search, setSearch] = useState('')

  const now = new Date()
  const subMap = new Map(submissions.map(s => [`${s.student_id}-${s.assignment_id}`, s]))

  const studentStats: StudentRow[] = students
    .map(student => {
      const late: Assignment[] = []
      const needsReview: Assignment[] = []
      const complete: Assignment[] = []
      const incomplete: Assignment[] = []

      for (const a of assignments) {
        const sub = subMap.get(`${student.id}-${a.id}`)
        if (!sub || sub.status === 'draft') {
          if (a.due_date && localDate(a.due_date) < now) late.push(a)
        } else if (sub.status === 'submitted') {
          needsReview.push(a)
        } else if (sub.status === 'graded') {
          if (sub.grade === 'complete') complete.push(a)
          else if (sub.grade === 'incomplete') incomplete.push(a)
        }
      }

      return { student, late, needsReview, complete, incomplete }
    })
    .sort((a, b) => {
      const aAttn = a.late.length + a.needsReview.length + a.incomplete.length
      const bAttn = b.late.length + b.needsReview.length + b.incomplete.length
      return bAttn - aAttn || a.student.name.localeCompare(b.student.name)
    })

  // Build speed grader queue: students with ungraded submissions
  const ungradedQueue = students
    .map(student => ({
      student,
      items: assignments.flatMap(a => {
        const sub = subMap.get(`${student.id}-${a.id}`)
        if (sub?.status === 'submitted') return [{ assignment: a, submissionId: sub.id }]
        return []
      }),
    }))
    .filter(s => s.items.length > 0)

  const searchLower = search.trim().toLowerCase()
  const filteredAssignments = searchLower
    ? assignments.filter(a => a.title.toLowerCase().includes(searchLower))
    : assignments

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search assignments…"
          aria-label="Search assignments"
          className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
      </div>

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
            onClick={() => setSpeedGraderOpen(true)}
            className="status-needs-grading-btn text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            {totalNeedsGrading} need grading
          </button>
        )}
      </div>

      {tab === 'assignments' ? (
        <AssignmentsTab
          courseId={courseId}
          modules={modules}
          assignments={filteredAssignments}
          statsByAssignment={statsByAssignment}
          totalStudents={totalStudents}
          filterUngraded={filterUngraded}
          onClearFilter={() => setFilterUngraded(false)}
        />
      ) : (
        <StudentsTab
          studentStats={studentStats}
          courseId={courseId}
          subMap={subMap}
          searchQuery={searchLower}
        />
      )}

      {speedGraderOpen && ungradedQueue.length > 0 && (
        <SpeedGrader
          courseId={courseId}
          instructorId={instructorId}
          queue={ungradedQueue}
          onClose={() => setSpeedGraderOpen(false)}
        />
      )}
    </div>
  )
}

// ── Speed Grader Modal ──────────────────────────────────────────────────────

type QueueItem = {
  student: Student
  items: { assignment: Assignment; submissionId: string }[]
}

function SpeedGrader({
  courseId,
  instructorId,
  queue,
  onClose,
}: {
  courseId: string
  instructorId: string
  queue: QueueItem[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set())
  const [grading, setGrading] = useState<Record<string, boolean>>({})

  const current = queue[index]
  const pendingItems = current?.items.filter(item => !gradedIds.has(item.submissionId)) ?? []
  const allGraded = current ? pendingItems.length === 0 : false
  const isLast = index === queue.length - 1

  const grade = async (submissionId: string, result: 'complete' | 'incomplete') => {
    if (grading[submissionId]) return
    setGrading(prev => ({ ...prev, [submissionId]: true }))
    const { error } = await saveGrade(submissionId, result, instructorId, courseId)
    if (error) {
      setGrading(prev => ({ ...prev, [submissionId]: false }))
      return
    }
    setGradedIds(prev => new Set([...prev, submissionId]))
    setGrading(prev => ({ ...prev, [submissionId]: false }))
  }

  const goTo = (i: number) => setIndex(i)

  // Keyboard shortcuts: C = complete first item, R = revision, ← / → = prev/next student
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const first = pendingItems[0]
      if (!allGraded && first) {
        if (e.key === 'c' || e.key === 'C') { e.preventDefault(); grade(first.submissionId, 'complete') }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); grade(first.submissionId, 'incomplete') }
      }
      if (e.key === 'ArrowRight' && !isLast) { e.preventDefault(); goTo(index + 1) }
      if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); goTo(index - 1) }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, pendingItems, allGraded, isLast, grading])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-dark-text">Speed Grader</h2>
            <p className="text-xs text-muted-text">
              Student {index + 1} of {queue.length}
              {!allGraded && <span className="ml-2 text-muted-text/70">· <kbd className="font-mono bg-border/40 px-1 rounded text-[10px]">C</kbd> complete <kbd className="font-mono bg-border/40 px-1 rounded text-[10px]">R</kbd> revision <kbd className="font-mono bg-border/40 px-1 rounded text-[10px]">←→</kbd> navigate</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-dark-text text-lg leading-none w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Student info */}
        <div className="px-5 py-3 border-b border-border bg-background shrink-0">
          <p className="text-base font-semibold text-dark-text">{current.student.name}</p>
          <p className="text-xs text-muted-text mt-0.5">
            {allGraded
              ? 'All assignments graded ✓'
              : `${pendingItems.length} assignment${pendingItems.length !== 1 ? 's' : ''} need grading`}
          </p>
        </div>

        {/* Assignments list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {allGraded ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-sm text-green-700 font-medium">All done for {current.student.name}!</p>
              {!isLast && (
                <button
                  onClick={() => goTo(index + 1)}
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-teal-light text-teal-primary border border-teal-primary/30 hover:bg-teal-primary/10 transition-colors"
                >
                  Next student →
                </button>
              )}
              {isLast && (
                <button
                  onClick={onClose}
                  className="status-complete-btn text-sm font-semibold px-4 py-2 rounded-lg border transition-colors"
                >
                  Done — close grader
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pendingItems.map(({ assignment, submissionId }) => {
                const isGrading = grading[submissionId]
                return (
                  <li key={submissionId} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-text leading-snug">{assignment.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-text flex-wrap">
                        <span>{assignment.moduleTitle}</span>
                        {assignment.due_date && (
                          <span>
                            · Due {formatDueDate(assignment.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        disabled={isGrading}
                        onClick={() => grade(submissionId, 'complete')}
                        className="status-complete-btn text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50 transition-colors"
                      >
                        {isGrading ? '…' : '✓ Complete'}
                      </button>
                      <button
                        disabled={isGrading}
                        onClick={() => grade(submissionId, 'incomplete')}
                        className="status-revision-btn text-xs font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50 transition-colors"
                      >
                        {isGrading ? '…' : '✗ Revision'}
                      </button>
                      <Link
                        href={`/instructor/courses/${courseId}/assignments/${assignment.id}/submissions/${current.student.id}`}
                        className="text-xs font-medium text-teal-primary hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
          <button
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            className="text-xs font-medium text-muted-text hover:text-dark-text disabled:opacity-40 transition-colors"
          >
            ← Prev
          </button>

          {queue.length > 1 && (
            <div className="flex gap-1.5 items-center">
              {queue.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-colors ${
                    i === index
                      ? 'w-2 h-2 bg-teal-primary'
                      : 'w-1.5 h-1.5 bg-border hover:bg-muted-text'
                  }`}
                />
              ))}
            </div>
          )}

          <button
            disabled={isLast}
            onClick={() => goTo(index + 1)}
            className="text-xs font-medium text-muted-text hover:text-dark-text disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Assignments Tab ─────────────────────────────────────────────────────────

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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(modules.map(m => m.id)))

  if (assignments.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text">No assignments in this course yet.</p>
      </div>
    )
  }

  const visibleModuleIds = modules
    .filter(m => assignments.some(a => {
      if (a.moduleTitle !== m.title) return false
      if (filterUngraded && !((statsByAssignment[a.id]?.needsGrading ?? 0) > 0)) return false
      return true
    }))
    .map(m => m.id)

  const allCollapsed = visibleModuleIds.every(id => collapsed.has(id))

  const toggleModule = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-1">
        {filterUngraded ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-yellow-600">Showing assignments that need grading</span>
            <button onClick={onClearFilter} className="text-xs text-muted-text hover:text-dark-text transition-colors">× Clear</button>
          </div>
        ) : <span />}
        {visibleModuleIds.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCollapsed(new Set())}
              className="text-xs text-muted-text hover:text-dark-text transition-colors"
            >
              Expand all
            </button>
            <span className="text-xs text-border">·</span>
            <button
              type="button"
              onClick={() => setCollapsed(new Set(visibleModuleIds))}
              className="text-xs text-muted-text hover:text-dark-text transition-colors"
            >
              Collapse all
            </button>
          </div>
        )}
      </div>
      {modules.map(m => {
        const moduleAssignments = assignments.filter(a => {
          if (a.moduleTitle !== m.title) return false
          if (filterUngraded && !((statsByAssignment[a.id]?.needsGrading ?? 0) > 0)) return false
          return true
        })
        if (moduleAssignments.length === 0) return null
        const isCollapsed = collapsed.has(m.id)
        const ungradedInModule = moduleAssignments.reduce((sum, a) => sum + (statsByAssignment[a.id]?.needsGrading ?? 0), 0)
        return (
          <div key={m.id}>
            <button
              type="button"
              onClick={() => toggleModule(m.id)}
              aria-expanded={!isCollapsed}
              className="w-full flex items-center justify-between px-1 py-2 text-left group"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                  {m.title}{m.week_number ? ` · Week ${m.week_number}` : ''}
                </span>
                {isCollapsed && ungradedInModule > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">
                    {ungradedInModule} ungraded
                  </span>
                )}
              </div>
              <span aria-hidden="true" className={`text-xs text-muted-text transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
            </button>
            {!isCollapsed && (
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
                              Due {formatDueDate(a.due_date, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                          {stats ? (
                            <>
                              <span>{stats.turnedIn}/{totalStudents} turned in</span>
                              {stats.complete > 0 && <span className="text-green-700">{stats.complete} complete</span>}
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
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Students Tab ────────────────────────────────────────────────────────────

function StudentsTab({
  studentStats,
  courseId,
  subMap,
  searchQuery,
}: {
  studentStats: StudentRow[]
  courseId: string
  subMap: Map<string, Sub>
  searchQuery: string
}) {
  const [expanded, setExpanded] = useState<{ studentId: string; category: ExpandKey } | null>(null)

  const filterAssignments = (list: Assignment[]) =>
    searchQuery ? list.filter(a => a.title.toLowerCase().includes(searchQuery)) : list

  const filteredStats = studentStats.map(row => ({
    ...row,
    late: filterAssignments(row.late),
    needsReview: filterAssignments(row.needsReview),
    complete: filterAssignments(row.complete),
    incomplete: filterAssignments(row.incomplete),
  })).filter(row =>
    !searchQuery || row.late.length + row.needsReview.length + row.complete.length + row.incomplete.length > 0
  )

  if (filteredStats.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text">{searchQuery ? 'No assignments match your search.' : 'No students enrolled.'}</p>
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
      {filteredStats.map(({ student, late, needsReview, complete, incomplete }) => {
        const isExpanded = (cat: ExpandKey) =>
          expanded?.studentId === student.id && expanded.category === cat

        const expandedList: Assignment[] =
          expanded?.studentId === student.id
            ? { late, needsReview, complete, incomplete }[expanded.category] ?? []
            : []

        const hasAnything = late.length + needsReview.length + complete.length + incomplete.length > 0

        return (
          <div key={student.id} className="bg-surface">
            <div className="px-6 py-4">
              <Link href={`/instructor/courses/${courseId}/roster/${student.id}`} className="text-sm font-semibold text-dark-text hover:text-teal-primary hover:underline mb-1.5 inline-block">{student.name}</Link>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                {late.length > 0 && (
                  <button
                    onClick={() => toggle(student.id, 'late')}
                    className={`font-medium transition-colors ${isExpanded('late') ? 'text-red-700 underline' : 'text-red-500 hover:underline'}`}
                  >
                    {late.length} late
                  </button>
                )}
                {needsReview.length > 0 && (
                  <button
                    onClick={() => toggle(student.id, 'needsReview')}
                    className={`font-medium transition-colors ${isExpanded('needsReview') ? 'text-yellow-700 underline' : 'text-yellow-600 hover:underline'}`}
                  >
                    {needsReview.length} ungraded
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
                    className={`font-medium transition-colors ${isExpanded('complete') ? 'text-green-700 underline' : 'text-green-600 hover:underline'}`}
                  >
                    {complete.length} complete
                  </button>
                )}
                {!hasAnything && (
                  <span className="text-muted-text">No activity yet</span>
                )}
              </div>
            </div>

            {expanded?.studentId === student.id && expandedList.length > 0 && (
              <div className="border-t border-border bg-background px-6 py-3 flex flex-col gap-1">
                {expandedList.map(a => {
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-4 py-1">
                      <span className="text-xs text-dark-text">{a.title}</span>
                      {expanded.category !== 'late' ? (
                        <Link
                          href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions/${student.id}?by=student`}
                          className="text-xs font-medium text-teal-primary hover:underline shrink-0"
                        >
                          {expanded.category === 'needsReview' ? 'Grade →' : 'View →'}
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
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

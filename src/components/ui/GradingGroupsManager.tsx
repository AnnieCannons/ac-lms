'use client'
import { useState, useTransition } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { setStudentGrader, bulkAssignStudentGraders, setAssignmentGrader, enableWeeklyRotation, disableWeeklyRotation, setGraderExcluded } from '@/lib/grading-groups-actions'
import UserAvatar from '@/components/ui/UserAvatar'

interface Student    { id: string; name: string; email: string; avatarUrl?: string | null }
interface Grader     { id: string; name: string; type: 'instructor' | 'ta'; avatarUrl?: string | null }
interface Assignment { id: string; title: string }
interface Module     { id: string; title: string; order: number }

interface Props {
  courseId: string
  students: Student[]
  graders: Grader[]
  hiddenGraders: Grader[]
  groupMap: Record<string, string | null>
  assignments: Assignment[]
  assignmentGraderMap: Record<string, string | null>
  graderUngradedCount: Record<string, number>
  modules: Module[]
  weeklyGroupMap: Record<string, Record<string, string | null>>
  weeklyRotationEnabled: boolean
  weeklyUngradedCount: Record<string, Record<string, number>>
}

export default function GradingGroupsManager({
  courseId, students, graders: initialGraders, hiddenGraders: initialHiddenGraders, groupMap, assignments, assignmentGraderMap, graderUngradedCount,
  modules, weeklyGroupMap, weeklyRotationEnabled, weeklyUngradedCount,
}: Props) {
  // Graders shown on the page vs. hidden via "Remove" (hidden ones keep course access)
  const [graders, setGraders] = useState<Grader[]>(initialGraders)
  const [hiddenGraders, setHiddenGraders] = useState<Grader[]>(initialHiddenGraders)

  // Course-level (flat) state
  const [studentAssignments, setStudentAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(students.map(s => [s.id, groupMap[s.id] ?? null]))
  )
  const [assignmentGraders, setAssignmentGraders] = useState<Record<string, string | null>>(
    Object.fromEntries(assignments.map(a => [a.id, assignmentGraderMap[a.id] ?? null]))
  )
  const [overrideErrors, setOverrideErrors] = useState<Record<string, string | null>>({})
  const [distributing, setDistributing] = useState(false)
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)

  // Weekly rotation state
  const [rotationEnabled, setRotationEnabled] = useState(weeklyRotationEnabled)
  const [weeklyAssignments, setWeeklyAssignments] = useState<Record<string, Record<string, string | null>>>(
    Object.fromEntries(modules.map(m => [
      m.id,
      Object.fromEntries(students.map(s => [s.id, weeklyGroupMap[m.id]?.[s.id] ?? null])),
    ]))
  )
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [enablingRotation, setEnablingRotation] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [rotationError, setRotationError] = useState<string | null>(null)

  const [, startTransition] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeStudent = students.find(s => s.id === activeStudentId) ?? null

  // ── Course-level (flat) handlers ──────────────────────────────────────────

  // Mirror of the server's syncStudentsWeeklyGroups: when rotation is on, moving a
  // student into/out of Unassigned in the base groups carries through every week.
  function applyBaseChangeToWeeks(prev: Record<string, string | null>, next: Record<string, string | null>) {
    if (!rotationEnabled || graders.length === 0) return
    const added: string[] = []
    const removed: string[] = []
    for (const s of students) {
      const was = !!prev[s.id]
      const is = !!next[s.id]
      if (!was && is) added.push(s.id)
      if (was && !is) removed.push(s.id)
    }
    if (added.length === 0 && removed.length === 0) return
    setWeeklyAssignments(weeks => Object.fromEntries(modules.map((m, i) => {
      const week = { ...(weeks[m.id] ?? {}) }
      for (const id of removed) week[id] = null
      for (const id of added) {
        const anchorIdx = graders.findIndex(g => g.id === next[id])
        week[id] = anchorIdx === -1 ? null : graders[(anchorIdx + i) % graders.length].id
      }
      return [m.id, week]
    })))
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveStudentId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveStudentId(null)
    const { active, over } = event
    if (!over) return
    const studentId = active.id as string
    const newGraderId = over.id === 'unassigned' ? null : over.id as string
    if (studentAssignments[studentId] === newGraderId) return
    const next = { ...studentAssignments, [studentId]: newGraderId }
    applyBaseChangeToWeeks(studentAssignments, next)
    setStudentAssignments(next)
    startTransition(async () => {
      await setStudentGrader(courseId, studentId, newGraderId)
    })
  }

  async function handleRotate() {
    if (graders.length < 2) return
    const newAssignments: Record<string, string | null> = {}
    for (const student of students) {
      const currentGraderId = studentAssignments[student.id]
      if (currentGraderId === null) {
        newAssignments[student.id] = null
      } else {
        const currentIdx = graders.findIndex(g => g.id === currentGraderId)
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % graders.length
        newAssignments[student.id] = graders[nextIdx].id
      }
    }
    setStudentAssignments(newAssignments)
    startTransition(async () => {
      const assigned = students
        .map(s => ({ studentId: s.id, graderId: newAssignments[s.id] }))
        .filter((e): e is { studentId: string; graderId: string } => e.graderId !== null)
      await bulkAssignStudentGraders(courseId, assigned)
    })
  }

  async function handleAutoDistribute() {
    if (graders.length === 0 || students.length === 0) return
    setDistributing(true)
    const newAssignments = Object.fromEntries(
      students.map((s, i) => [s.id, graders[i % graders.length].id])
    )
    applyBaseChangeToWeeks(studentAssignments, newAssignments)
    setStudentAssignments(newAssignments)
    await bulkAssignStudentGraders(
      courseId,
      students.map((s, i) => ({ studentId: s.id, graderId: graders[i % graders.length].id }))
    )
    setDistributing(false)
  }

  function handleAssignmentGrader(assignmentId: string, graderId: string | null) {
    const previous = assignmentGraders[assignmentId] ?? null
    setAssignmentGraders(prev => ({ ...prev, [assignmentId]: graderId }))
    setOverrideErrors(prev => ({ ...prev, [assignmentId]: null }))
    startTransition(async () => {
      const result = await setAssignmentGrader(assignmentId, graderId, courseId)
      if (result.error) {
        setAssignmentGraders(prev => ({ ...prev, [assignmentId]: previous }))
        setOverrideErrors(prev => ({ ...prev, [assignmentId]: `Couldn't save: ${result.error}` }))
      }
    })
  }

  // ── Hide / restore graders ─────────────────────────────────────────────────

  function handleRemoveGrader(grader: Grader) {
    const baseCount = students.filter(s => studentAssignments[s.id] === grader.id).length
    const hasWeekly = rotationEnabled && Object.values(weeklyAssignments).some(week => Object.values(week).includes(grader.id))
    const hasOverrides = Object.values(assignmentGraders).includes(grader.id)
    const consequences = [
      baseCount > 0 && `${baseCount} student${baseCount === 1 ? '' : 's'} will move to Unassigned`,
      hasWeekly && 'their weekly rotation groups will be cleared',
      hasOverrides && 'their assignment overrides will be reset',
    ].filter(Boolean)
    const message = `Remove ${grader.name} from grading groups?` +
      (consequences.length ? `\n\n${consequences.join('; ')}.` : '') +
      `\n\nThey'll stay enrolled in the course, and you can add them back anytime.`
    if (!confirm(message)) return

    const clear = (map: Record<string, string | null>) =>
      Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v === grader.id ? null : v]))
    setStudentAssignments(prev => clear(prev))
    setWeeklyAssignments(prev => Object.fromEntries(Object.entries(prev).map(([m, week]) => [m, clear(week)])))
    setAssignmentGraders(prev => clear(prev))
    setGraders(prev => prev.filter(g => g.id !== grader.id))
    setHiddenGraders(prev => [...prev, grader].sort((a, b) => a.name.localeCompare(b.name)))
    startTransition(async () => { await setGraderExcluded(courseId, grader.id, true) })
  }

  function handleRestoreGrader(grader: Grader) {
    setHiddenGraders(prev => prev.filter(g => g.id !== grader.id))
    setGraders(prev => [...prev, grader].sort((a, b) => a.name.localeCompare(b.name)))
    startTransition(async () => { await setGraderExcluded(courseId, grader.id, false) })
  }

  // ── Weekly rotation handlers ───────────────────────────────────────────────

  async function handleEnableRotation() {
    const assignedCount = students.filter(s => studentAssignments[s.id]).length
    if (assignedCount === 0) {
      setRotationError('Set up base groups first using Auto-distribute, then enable weekly rotation.')
      return
    }
    setRotationError(null)
    setEnablingRotation(true)
    const result = await enableWeeklyRotation(courseId)
    if (result.error) {
      setRotationError(result.error)
      setEnablingRotation(false)
      return
    }
    if (result.weeklyGroups) {
      setWeeklyAssignments(
        Object.fromEntries(modules.map(m => [
          m.id,
          Object.fromEntries(students.map(s => [s.id, result.weeklyGroups![m.id]?.[s.id] ?? null])),
        ]))
      )
    }
    setRotationEnabled(true)
    setEnablingRotation(false)
  }

  async function handleDisableRotation() {
    await disableWeeklyRotation(courseId)
    setRotationEnabled(false)
    setShowDisableConfirm(false)
  }

  function handleStudentMoveWeek(moduleId: string, studentId: string, graderId: string | null) {
    setWeeklyAssignments(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [studentId]: graderId },
    }))
    startTransition(async () => {
      await setStudentGrader(courseId, studentId, graderId, moduleId)
    })
  }

  function handleRotateWeek(moduleId: string) {
    if (graders.length < 2) return
    const currentMap = weeklyAssignments[moduleId] ?? {}
    const newMap: Record<string, string | null> = {}
    for (const student of students) {
      const currentGraderId = currentMap[student.id] ?? null
      if (currentGraderId === null) {
        newMap[student.id] = null
      } else {
        const currentIdx = graders.findIndex(g => g.id === currentGraderId)
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % graders.length
        newMap[student.id] = graders[nextIdx].id
      }
    }
    setWeeklyAssignments(prev => ({ ...prev, [moduleId]: newMap }))
    startTransition(async () => {
      const assigned = students
        .map(s => ({ studentId: s.id, graderId: newMap[s.id] }))
        .filter((e): e is { studentId: string; graderId: string } => e.graderId !== null)
      await bulkAssignStudentGraders(courseId, assigned, moduleId)
    })
  }

  function handleAutoDistributeWeek(moduleId: string) {
    // Students unassigned in the base groups stay out of every week
    const inRotation = students.filter(s => studentAssignments[s.id])
    if (graders.length === 0 || inRotation.length === 0) return
    const distributed = inRotation.map((s, i) => ({ studentId: s.id, graderId: graders[i % graders.length].id }))
    const newMap: Record<string, string | null> = Object.fromEntries(students.map(s => [s.id, null]))
    for (const d of distributed) newMap[d.studentId] = d.graderId
    setWeeklyAssignments(prev => ({ ...prev, [moduleId]: newMap }))
    startTransition(async () => {
      await bulkAssignStudentGraders(courseId, distributed, moduleId)
    })
  }

  function toggleModule(moduleId: string) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId)
      return next
    })
  }

  // ── Flat layout helpers ────────────────────────────────────────────────────

  const studentsForGrader = (graderId: string | null) =>
    students.filter(s => studentAssignments[s.id] === graderId)
  const unassigned = studentsForGrader(null)
  const assignedCount = students.length - unassigned.length

  return (
    <div className="space-y-8">
      {/* Weekly rotation toggle */}
      <div className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border">
        <div className="flex-1">
          <p className="text-sm font-semibold text-dark-text">Weekly Rotation</p>
          <p className="text-xs text-muted-text mt-0.5">
            Create separate grading groups for each week. Graders rotate through student groups automatically.
          </p>
          {rotationError && (
            <p className="text-xs text-red-500 mt-1">{rotationError}</p>
          )}
        </div>
        {rotationEnabled ? (
          <button
            onClick={() => setShowDisableConfirm(true)}
            className="shrink-0 text-sm border border-border px-3 py-1.5 rounded-lg text-muted-text hover:border-red-400 hover:text-red-500 transition-colors"
          >
            Disable
          </button>
        ) : (
          <button
            onClick={handleEnableRotation}
            disabled={enablingRotation}
            className="shrink-0 text-sm bg-teal-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {enablingRotation ? 'Enabling…' : 'Enable'}
          </button>
        )}
      </div>

      {/* Disable confirmation */}
      {showDisableConfirm && (
        <div className="p-4 bg-surface border border-border rounded-xl">
          <p className="text-sm font-semibold text-red-500 mb-1">Disable weekly rotation?</p>
          <p className="text-xs text-muted-text mb-3">
            All week-specific group assignments will be deleted. Your base groups will remain.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDisableRotation}
              className="text-sm bg-red-500 text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Yes, disable
            </button>
            <button
              onClick={() => setShowDisableConfirm(false)}
              className="text-sm border border-border px-3 py-1.5 rounded-lg hover:border-teal-primary text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {hiddenGraders.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-text">Removed from grading:</span>
          {hiddenGraders.map(g => (
            <span key={g.id} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border border-border bg-surface">
              <UserAvatar name={g.name} avatarUrl={g.avatarUrl} size="sm" />
              <span className="text-dark-text">{g.name}</span>
              <button
                type="button"
                onClick={() => handleRestoreGrader(g)}
                className="text-xs text-teal-primary hover:underline ml-1"
              >
                Add back
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Base (course-level) groups — the anchor weekly rotation rotates from ── */}
      <section className="space-y-4">
        {rotationEnabled && (
          <div>
            <h2 className="text-base font-semibold text-dark-text">Base Groups</h2>
            <p className="text-xs text-muted-text mt-0.5">
              Each week rotates from these groups automatically, including new weeks as they&apos;re published.
              Students in Unassigned stay out of every week until you move them into a group here.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-text">
            {assignedCount} of {students.length} students assigned · {graders.length} grader{graders.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            {graders.length >= 2 && (
              <button
                onClick={handleRotate}
                disabled={distributing}
                className="border border-border text-dark-text px-4 py-2 rounded-lg text-sm font-medium hover:border-teal-primary hover:text-teal-primary disabled:opacity-50 transition-colors"
                title={graders.length === 2 ? 'Swap the two groups' : 'Shift each grader to the next group in order'}
              >
                {graders.length === 2 ? 'Swap Groups ⇄' : 'Rotate Groups →'}
              </button>
            )}
            <button
              onClick={handleAutoDistribute}
              disabled={distributing || students.length === 0}
              className="bg-teal-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {distributing ? 'Distributing…' : 'Auto-distribute evenly'}
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={`grid gap-4 ${graders.length === 1 ? 'grid-cols-1 max-w-sm' : graders.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {graders.map(grader => (
              <GraderCard
                key={grader.id}
                grader={grader}
                students={studentsForGrader(grader.id)}
                ungradedCount={graderUngradedCount[grader.id] ?? 0}
                onRemove={() => handleRemoveGrader(grader)}
              />
            ))}
            <UnassignedCard students={unassigned} />
          </div>
          <DragOverlay>
            {activeStudent ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-teal-primary text-sm text-dark-text shadow-lg cursor-grabbing">
                <UserAvatar name={activeStudent.name} avatarUrl={activeStudent.avatarUrl} size="sm" />
                {activeStudent.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>

      {rotationEnabled && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-dark-text">Weekly Groups</h2>
            <p className="text-xs text-muted-text mt-0.5">
              Filled in automatically. Open a week only if you need to tweak it — changes there affect just that week.
            </p>
          </div>
          {modules.map(module => (
            <WeekSection
              key={module.id}
              module={module}
              students={students}
              graders={graders}
              weekAssignments={weeklyAssignments[module.id] ?? {}}
              weekUngradedCount={weeklyUngradedCount[module.id] ?? {}}
              expanded={expandedModules.has(module.id)}
              onToggle={() => toggleModule(module.id)}
              onStudentMove={(studentId, graderId) => handleStudentMoveWeek(module.id, studentId, graderId)}
              onRotate={() => handleRotateWeek(module.id)}
              onAutoDistribute={() => handleAutoDistributeWeek(module.id)}
              onRemoveGrader={handleRemoveGrader}
            />
          ))}
        </section>
      )}

      {/* Assignment overrides — always shown */}
      {assignments.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-dark-text mb-1">Assignment Overrides</h2>
          <p className="text-xs text-muted-text mb-4">
            Override the grader for a specific assignment — that person grades it for all students.
            Leave as &ldquo;Follow student group&rdquo; to use each student&apos;s assigned grader.
          </p>
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border">
            {assignments.map(assignment => (
              <div key={assignment.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-dark-text truncate">{assignment.title}</p>
                  {overrideErrors[assignment.id] && (
                    <p className="text-xs text-red-500 mt-0.5">{overrideErrors[assignment.id]}</p>
                  )}
                </div>
                <select
                  value={assignmentGraders[assignment.id] ?? ''}
                  onChange={e => handleAssignmentGrader(assignment.id, e.target.value || null)}
                  className="shrink-0 text-sm bg-background border border-border rounded-lg px-3 py-1.5 text-dark-text focus:outline-none focus:border-teal-primary"
                >
                  <option value="">Follow student group</option>
                  {graders.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.type === 'ta' ? 'TA' : 'Staff'})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── WeekSection ────────────────────────────────────────────────────────────────

interface WeekSectionProps {
  module: Module
  students: Student[]
  graders: Grader[]
  weekAssignments: Record<string, string | null>
  weekUngradedCount: Record<string, number>
  expanded: boolean
  onToggle: () => void
  onStudentMove: (studentId: string, graderId: string | null) => void
  onRotate: () => void
  onAutoDistribute: () => void
  onRemoveGrader: (grader: Grader) => void
}

function WeekSection({
  module, students, graders, weekAssignments, weekUngradedCount,
  expanded, onToggle, onStudentMove, onRotate, onAutoDistribute, onRemoveGrader,
}: WeekSectionProps) {
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeStudent = students.find(s => s.id === activeStudentId) ?? null

  const studentsForGrader = (graderId: string | null) =>
    students.filter(s => (weekAssignments[s.id] ?? null) === graderId)
  const unassigned = studentsForGrader(null)
  const totalUngraded = Object.values(weekUngradedCount).reduce((sum, n) => sum + n, 0)

  function handleDragEnd(event: DragEndEvent) {
    setActiveStudentId(null)
    const { active, over } = event
    if (!over) return
    const studentId = active.id as string
    const newGraderId = over.id === 'unassigned' ? null : over.id as string
    if ((weekAssignments[studentId] ?? null) === newGraderId) return
    onStudentMove(studentId, newGraderId)
  }

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-light/5 transition-colors text-left"
        onClick={onToggle}
      >
        <span className="font-semibold text-sm text-dark-text">{module.title}</span>
        <div className="flex items-center gap-2">
          {totalUngraded > 0 && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full badge-count">
              {totalUngraded} ungraded
            </span>
          )}
          <span className="text-muted-text text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pt-4 pb-4 space-y-4">
          {/* Per-week rotate + auto-distribute */}
          <div className="flex items-center justify-end gap-2">
            {graders.length >= 2 && (
              <button
                onClick={onRotate}
                className="border border-border text-dark-text px-3 py-1.5 rounded-lg text-sm font-medium hover:border-teal-primary hover:text-teal-primary transition-colors"
                title={graders.length === 2 ? 'Swap the two groups for this week' : 'Rotate groups for this week'}
              >
                {graders.length === 2 ? 'Swap Groups ⇄' : 'Rotate Groups →'}
              </button>
            )}
            <button
              onClick={onAutoDistribute}
              disabled={students.length === 0}
              className="bg-teal-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Auto-distribute evenly
            </button>
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={e => setActiveStudentId(e.active.id as string)}
            onDragEnd={handleDragEnd}
          >
            <div className={`grid gap-4 ${graders.length === 1 ? 'grid-cols-1 max-w-sm' : graders.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
              {graders.map(grader => (
                <GraderCard
                  key={grader.id}
                  grader={grader}
                  students={studentsForGrader(grader.id)}
                  ungradedCount={weekUngradedCount[grader.id] ?? 0}
                  onRemove={() => onRemoveGrader(grader)}
                />
              ))}
              <UnassignedCard students={unassigned} />
            </div>
            <DragOverlay>
              {activeStudent ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-teal-primary text-sm text-dark-text shadow-lg cursor-grabbing">
                  <UserAvatar name={activeStudent.name} avatarUrl={activeStudent.avatarUrl} size="sm" />
                  {activeStudent.name}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function GraderCard({ grader, students, ungradedCount, onRemove }: { grader: Grader; students: Student[]; ungradedCount: number; onRemove: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: grader.id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 transition-colors ${isOver ? 'border-teal-primary bg-teal-light/10' : 'border-border bg-surface'}`}
    >
      <div className="px-4 py-3 border-b border-border flex items-start gap-2">
        <UserAvatar name={grader.name} avatarUrl={grader.avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dark-text text-sm truncate">{grader.name}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${grader.type === 'ta' ? 'badge-ta' : 'bg-purple-light text-purple-primary'}`}>
              {grader.type === 'ta' ? 'TA' : 'Staff'}
            </span>
            {ungradedCount > 0 && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full badge-count">
                {ungradedCount} ungraded
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-text shrink-0 leading-6" title={`${students.length} student${students.length === 1 ? '' : 's'}`}>
          {students.length}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${grader.name} from grading groups`}
          title="Remove from grading groups"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted-text hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          ×
        </button>
      </div>
      <div className="p-2 min-h-[72px] flex flex-col gap-1">
        {students.map(s => <DraggableStudent key={s.id} student={s} />)}
        {students.length === 0 && (
          <p className="text-xs text-muted-text text-center py-5">Drop students here</p>
        )}
      </div>
    </div>
  )
}

function UnassignedCard({ students }: { students: Student[] }) {
  // Always rendered so there's somewhere to drop a student even when it's empty
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 border-dashed transition-colors ${isOver ? 'border-teal-primary bg-teal-light/10' : 'border-border bg-surface'}`}
    >
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <p className="font-semibold text-muted-text text-sm flex-1">Unassigned</p>
        <span className="text-xs text-muted-text">{students.length}</span>
      </div>
      <div className="p-2 min-h-[72px] flex flex-col gap-1">
        {students.map(s => <DraggableStudent key={s.id} student={s} />)}
        {students.length === 0 && (
          <p className="text-xs text-muted-text text-center py-5">Drop here to unassign</p>
        )}
      </div>
    </div>
  )
}

function DraggableStudent({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: student.id })
  return (
    <div
      ref={setNodeRef}
      style={{ touchAction: 'none', opacity: isDragging ? 0 : 1 }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border text-sm text-dark-text cursor-grab active:cursor-grabbing select-none hover:border-teal-primary/40"
      {...attributes}
      {...listeners}
    >
      <UserAvatar name={student.name} avatarUrl={student.avatarUrl} size="sm" />
      {student.name}
    </div>
  )
}

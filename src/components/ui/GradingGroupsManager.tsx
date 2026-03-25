'use client'
import { useState, useTransition } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { setStudentGrader, bulkAssignStudentGraders, setAssignmentGrader, enableWeeklyRotation, disableWeeklyRotation } from '@/lib/grading-groups-actions'

interface Student    { id: string; name: string; email: string }
interface Grader     { id: string; name: string; type: 'instructor' | 'ta' }
interface Assignment { id: string; title: string }
interface Module     { id: string; title: string; order: number }

interface Props {
  courseId: string
  students: Student[]
  graders: Grader[]
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
  courseId, students, graders, groupMap, assignments, assignmentGraderMap, graderUngradedCount,
  modules, weeklyGroupMap, weeklyRotationEnabled, weeklyUngradedCount,
}: Props) {
  // Course-level (flat) state
  const [studentAssignments, setStudentAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(students.map(s => [s.id, groupMap[s.id] ?? null]))
  )
  const [assignmentGraders, setAssignmentGraders] = useState<Record<string, string | null>>(
    Object.fromEntries(assignments.map(a => [a.id, assignmentGraderMap[a.id] ?? null]))
  )
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
    setStudentAssignments(prev => ({ ...prev, [studentId]: newGraderId }))
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
    setStudentAssignments(newAssignments)
    await bulkAssignStudentGraders(
      courseId,
      students.map((s, i) => ({ studentId: s.id, graderId: graders[i % graders.length].id }))
    )
    setDistributing(false)
  }

  function handleAssignmentGrader(assignmentId: string, graderId: string | null) {
    setAssignmentGraders(prev => ({ ...prev, [assignmentId]: graderId }))
    startTransition(async () => { await setAssignmentGrader(assignmentId, graderId, courseId) })
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
    if (graders.length === 0 || students.length === 0) return
    const newMap = Object.fromEntries(
      students.map((s, i) => [s.id, graders[i % graders.length].id])
    )
    setWeeklyAssignments(prev => ({ ...prev, [moduleId]: newMap }))
    startTransition(async () => {
      await bulkAssignStudentGraders(
        courseId,
        students.map((s, i) => ({ studentId: s.id, graderId: graders[i % graders.length].id })),
        moduleId
      )
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

      {rotationEnabled ? (
        /* ── Weekly sections ── */
        <div className="space-y-3">
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
            />
          ))}
        </div>
      ) : (
        /* ── Flat (course-level) layout ── */
        <>
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
                />
              ))}
              <UnassignedCard students={unassigned} />
            </div>
            <DragOverlay>
              {activeStudent ? (
                <div className="px-3 py-2 rounded-lg bg-surface border border-teal-primary text-sm text-dark-text shadow-lg cursor-grabbing">
                  {activeStudent.name}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
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
                <p className="text-sm text-dark-text truncate min-w-0">{assignment.title}</p>
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
}

function WeekSection({
  module, students, graders, weekAssignments, weekUngradedCount,
  expanded, onToggle, onStudentMove, onRotate, onAutoDistribute,
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
                />
              ))}
              <UnassignedCard students={unassigned} />
            </div>
            <DragOverlay>
              {activeStudent ? (
                <div className="px-3 py-2 rounded-lg bg-surface border border-teal-primary text-sm text-dark-text shadow-lg cursor-grabbing">
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

function GraderCard({ grader, students, ungradedCount }: { grader: Grader; students: Student[]; ungradedCount: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: grader.id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 transition-colors ${isOver ? 'border-teal-primary bg-teal-light/10' : 'border-border bg-surface'}`}
    >
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dark-text text-sm truncate">{grader.name}</p>
        </div>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${grader.type === 'ta' ? 'badge-ta' : 'bg-purple-light text-purple-primary'}`}>
          {grader.type === 'ta' ? 'TA' : 'Staff'}
        </span>
        {ungradedCount > 0 && (
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full badge-count shrink-0">
            {ungradedCount} ungraded
          </span>
        )}
        <span className="text-xs text-muted-text shrink-0 w-5 text-right">{students.length}</span>
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
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' })
  if (students.length === 0 && !isOver) return null
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
      className="px-3 py-2 rounded-lg bg-background border border-border text-sm text-dark-text cursor-grab active:cursor-grabbing select-none hover:border-teal-primary/40"
      {...attributes}
      {...listeners}
    >
      {student.name}
    </div>
  )
}

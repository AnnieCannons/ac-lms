'use client'
import { useState, useTransition } from 'react'
import { DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { setStudentGrader, bulkAssignStudentGraders, setAssignmentGrader } from '@/lib/grading-groups-actions'

interface Student    { id: string; name: string; email: string }
interface Grader     { id: string; name: string; type: 'instructor' | 'ta' }
interface Assignment { id: string; title: string }

interface Props {
  courseId: string
  students: Student[]
  graders: Grader[]
  groupMap: Record<string, string | null>
  assignments: Assignment[]
  assignmentGraderMap: Record<string, string | null>
}

export default function GradingGroupsManager({
  courseId, students, graders, groupMap, assignments, assignmentGraderMap,
}: Props) {
  const [studentAssignments, setStudentAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(students.map(s => [s.id, groupMap[s.id] ?? null]))
  )
  const [assignmentGraders, setAssignmentGraders] = useState<Record<string, string | null>>(
    Object.fromEntries(assignments.map(a => [a.id, assignmentGraderMap[a.id] ?? null]))
  )
  const [distributing, setDistributing] = useState(false)
  const [, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
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
    startTransition(async () => { await setAssignmentGrader(assignmentId, graderId) })
  }

  const studentsForGrader = (graderId: string | null) =>
    students.filter(s => studentAssignments[s.id] === graderId)

  const unassigned = studentsForGrader(null)
  const assignedCount = students.length - unassigned.length

  return (
    <div className="space-y-8">
      {/* Stats + auto-distribute */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-text">
          {assignedCount} of {students.length} students assigned · {graders.length} grader{graders.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleAutoDistribute}
          disabled={distributing || students.length === 0}
          className="bg-teal-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {distributing ? 'Distributing…' : 'Auto-distribute evenly'}
        </button>
      </div>

      {/* Grader cards — drag students between them */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={`grid gap-4 ${graders.length === 1 ? 'grid-cols-1 max-w-sm' : graders.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {graders.map(grader => (
            <GraderCard
              key={grader.id}
              grader={grader}
              students={studentsForGrader(grader.id)}
            />
          ))}
          <UnassignedCard students={unassigned} />
        </div>
      </DndContext>

      {/* Assignment overrides */}
      {assignments.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-dark-text mb-1">Assignment Overrides</h2>
          <p className="text-xs text-muted-text mb-4">
            Override the grader for a specific assignment — that person grades it for all students.
            Leave as "Follow student group" to use each student's assigned grader.
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
                      {g.name} ({g.type === 'ta' ? 'TA' : 'Instructor'})
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

function GraderCard({ grader, students }: { grader: Grader; students: Student[] }) {
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
          {grader.type === 'ta' ? 'TA' : 'Instructor'}
        </span>
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: student.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={`px-3 py-2 rounded-lg bg-background border border-border text-sm text-dark-text cursor-grab active:cursor-grabbing select-none transition-opacity ${isDragging ? 'opacity-40' : 'hover:border-teal-primary/40'}`}
      {...attributes}
      {...listeners}
    >
      {student.name}
    </div>
  )
}

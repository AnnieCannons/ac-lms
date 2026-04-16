'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import GradebookCell from './GradebookCell'

export interface GradebookStudent { id: string; name: string }
export interface GradebookAssignment {
  id: string
  title: string
  due_date: string | null
  moduleId: string
  moduleTitle: string
  weekNumber: number | null
}
export interface GradebookSubmission {
  assignment_id: string
  student_id: string
  status: string
  grade: string | null
}
export interface GradebookModule { id: string; title: string; week_number: number | null }

interface Props {
  courseId: string
  students: GradebookStudent[]
  modules: GradebookModule[]
  assignments: GradebookAssignment[]
  submissions: GradebookSubmission[]
  myGroupCourseLevel: string[]
  myGroupByModule: Record<string, string[]>
  modulesWithWeeklyGroups: string[]
  hasMyGroup: boolean
}

const DEFAULT_COL_WIDTH = 150
const MIN_COL_WIDTH = 60
const NAME_COL_WIDTH = 192

function MultiSelectDropdown({
  label,
  allLabel,
  items,
  selected,
  onToggle,
  onClear,
  searchable,
  dropdownWidth = 224,
  specialOption,
}: {
  label: string
  allLabel: string
  items: { id: string; name: string }[]
  selected: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
  searchable?: boolean
  dropdownWidth?: number
  specialOption?: { label: string; active: boolean; onClick: () => void }
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const visible = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  const buttonLabel = specialOption?.active
    ? specialOption.label
    : selected.size === 0
    ? allLabel
    : selected.size === 1
      ? items.find(i => selected.has(i.id))?.name ?? `1 selected`
      : `${selected.size} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-dark-text hover:border-teal-primary/60 transition-colors max-w-48"
      >
        <span className="font-medium truncate">{buttonLabel}</span>
        {selected.size > 0 && (
          <span className="text-xs bg-teal-primary text-white rounded-full px-1.5 py-0.5 font-semibold leading-none shrink-0">
            {selected.size}
          </span>
        )}
        <span className="text-muted-text text-xs shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border-2 border-border rounded-xl shadow-xl p-3 max-h-72 flex flex-col" style={{ width: dropdownWidth }}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-xs font-bold text-muted-text uppercase tracking-wide">{label}</span>
            {selected.size > 0 && (
              <button onClick={onClear} className="text-xs text-teal-primary hover:underline">Clear</button>
            )}
          </div>
          {searchable && (
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1 mb-2 bg-surface text-dark-text placeholder:text-muted-text/60 shrink-0"
              autoFocus
            />
          )}
          <div className="overflow-y-auto flex flex-col gap-0.5">
            <button
              onClick={onClear}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${selected.size === 0 && !specialOption?.active ? 'bg-teal-light text-teal-primary font-semibold' : 'text-dark-text hover:bg-surface'}`}
            >
              {allLabel}
            </button>
            {specialOption && (
              <button
                onClick={specialOption.onClick}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${specialOption.active ? 'bg-teal-light text-teal-primary font-semibold' : 'text-dark-text hover:bg-surface'}`}
              >
                {specialOption.label}
              </button>
            )}
            {visible.map(item => (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${selected.has(item.id) ? 'bg-teal-light text-teal-primary font-semibold' : 'text-dark-text hover:bg-surface'}`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${selected.has(item.id) ? 'bg-teal-primary border-teal-primary text-white' : 'border-border'}`}>
                  {selected.has(item.id) ? '✓' : ''}
                </span>
                <span className="truncate">{item.name}</span>
              </button>
            ))}
            {visible.length === 0 && (
              <p className="text-xs text-muted-text px-2 py-2">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GradebookGrid({ courseId, students, modules, assignments, submissions, myGroupCourseLevel, myGroupByModule, modulesWithWeeklyGroups, hasMyGroup }: Props) {
  const modulesStorageKey = `gradebook-modules-${courseId}`
  const [selectedModules, setSelectedModules] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(modulesStorageKey)
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch {}
    return new Set()
  })
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set())
  const [myGroupActive, setMyGroupActive] = useState(false)
  const [colWidths, setColWidths] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    try { localStorage.setItem(modulesStorageKey, JSON.stringify([...selectedModules])) } catch {}
  }, [selectedModules])

  const weeklyModuleSet = new Set(modulesWithWeeklyGroups)

  const toggleModule = (id: string) => setSelectedModules(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleStudent = (id: string) => setSelectedStudents(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleAssignment = (id: string) => setSelectedAssignments(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const getColWidth = (id: string) => colWidths.get(id) ?? DEFAULT_COL_WIDTH

  const startResize = useCallback((assignmentId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths.get(assignmentId) ?? DEFAULT_COL_WIDTH

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + e.clientX - startX)
      setColWidths(prev => new Map(prev).set(assignmentId, newWidth))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [colWidths])

  // Resolve "My Grading Group" student IDs based on selected week
  const myGroupStudentIds: Set<string> | null = (() => {
    if (!myGroupActive) return null
    if (selectedModules.size === 1) {
      const [moduleId] = selectedModules
      if (weeklyModuleSet.has(moduleId) && myGroupByModule[moduleId]) {
        return new Set(myGroupByModule[moduleId])
      }
    }
    return new Set(myGroupCourseLevel)
  })()

  const filteredStudents = myGroupActive && myGroupStudentIds
    ? students.filter(s => myGroupStudentIds.has(s.id))
    : selectedStudents.size === 0
    ? students
    : students.filter(s => selectedStudents.has(s.id))

  const filteredAssignments = assignments
    .filter(a => selectedModules.size === 0 || selectedModules.has(a.moduleId))
    .filter(a => selectedAssignments.size === 0 || selectedAssignments.has(a.id))

  const submissionMap = new Map<string, GradebookSubmission>()
  for (const sub of submissions) {
    submissionMap.set(`${sub.assignment_id}_${sub.student_id}`, sub)
  }

  const moduleItems = modules.map(m => ({ id: m.id, name: m.title }))
  const studentItems = students.map(s => ({ id: s.id, name: s.name }))
  const assignmentItems = assignments.map(a => ({ id: a.id, name: a.title }))

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <MultiSelectDropdown
          label="Filter by week"
          allLabel="All Weeks"
          items={moduleItems}
          selected={selectedModules}
          onToggle={toggleModule}
          onClear={() => setSelectedModules(new Set())}
        />

        <MultiSelectDropdown
          label="Filter by student"
          allLabel="All Students"
          items={studentItems}
          selected={selectedStudents}
          onToggle={id => { setMyGroupActive(false); toggleStudent(id) }}
          onClear={() => { setSelectedStudents(new Set()); setMyGroupActive(false) }}
          searchable
          specialOption={hasMyGroup ? {
            label: 'My Grading Group',
            active: myGroupActive,
            onClick: () => { setMyGroupActive(true); setSelectedStudents(new Set()) },
          } : undefined}
        />

        <MultiSelectDropdown
          label="Filter by assignment"
          allLabel="All Assignments"
          items={assignmentItems}
          selected={selectedAssignments}
          onToggle={toggleAssignment}
          onClear={() => setSelectedAssignments(new Set())}
          searchable
          dropdownWidth={600}
        />

        <span className="text-xs text-muted-text">{filteredAssignments.length} assignments · {filteredStudents.length} students</span>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          <span className="text-xs text-muted-text font-medium">Key:</span>
          <span className="flex items-center gap-1 text-xs"><span className="inline-flex w-6 h-5 items-center justify-center text-xs font-bold status-complete-btn rounded border border-border/30">✓</span> Complete</span>
          <span className="flex items-center gap-1 text-xs"><span className="inline-flex w-6 h-5 items-center justify-center text-xs font-bold status-revision-btn rounded border border-border/30">✗</span> Needs Revision</span>
          <span className="flex items-center gap-1 text-xs"><span className="inline-flex w-6 h-5 items-center justify-center text-xs font-bold status-needs-grading-btn rounded border border-border/30">●</span> Ungraded</span>
          <span className="flex items-center gap-1 text-xs"><span className="inline-flex w-6 h-5 items-center justify-center text-xs font-bold status-late-badge rounded border border-border/30">–</span> Late / missing</span>
          <span className="flex items-center gap-1 text-xs"><span className="inline-flex w-6 h-5 items-center justify-center text-xs font-bold border border-border rounded"> </span> Not yet due</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-surface">
              <th
                className="sticky left-0 z-30 bg-surface border-b border-r border-border px-3 py-2 text-left text-xs font-semibold text-muted-text uppercase tracking-wide"
                style={{ width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH }}
              >
                Student
              </th>
              {filteredAssignments.map(a => {
                const w = getColWidth(a.id)
                return (
                  <th
                    key={a.id}
                    className="relative border-b border-r border-border/60 bg-surface text-left align-top"
                    style={{ width: w, minWidth: MIN_COL_WIDTH }}
                  >
                    <div className="px-2 pt-3 pb-2 overflow-hidden" style={{ width: w - 8 }}>
                      {a.weekNumber != null && (
                        <span className="text-[10px] text-muted-text/70 font-normal block leading-none mb-1">W{a.weekNumber}</span>
                      )}
                      <Link
                        href={`/instructor/courses/${courseId}/assignments/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-normal tracking-tight text-dark-text block overflow-hidden whitespace-nowrap text-ellipsis hover:text-teal-primary hover:underline"
                        title={`${a.title}${a.due_date ? ` · Due ${new Date(a.due_date).toLocaleDateString()}` : ''} · Click to edit`}
                      >
                        {a.title}
                      </Link>
                    </div>
                    <div
                      onMouseDown={(e) => startResize(a.id, e)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-teal-primary/30 transition-colors"
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, i) => (
              <tr key={student.id} className={i % 2 === 0 ? '' : 'bg-surface/30'}>
                <td
                  className="sticky left-0 z-10 border-b border-r border-border px-3 py-2.5 text-sm truncate bg-background"
                  style={{ width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH }}
                >
                  <a
                    href={`/instructor/courses/${courseId}/roster/${student.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-primary hover:underline font-medium"
                  >
                    {student.name}
                  </a>
                </td>
                {filteredAssignments.map(a => (
                  <GradebookCell
                    key={a.id}
                    courseId={courseId}
                    assignmentId={a.id}
                    studentId={student.id}
                    submission={submissionMap.get(`${a.id}_${student.id}`) ?? null}
                    dueDate={a.due_date}
                  />
                ))}
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={filteredAssignments.length + 1} className="px-6 py-10 text-center text-sm text-muted-text">
                  {students.length === 0 ? 'No students enrolled' : 'No students match your filter'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredAssignments.length === 0 && filteredStudents.length > 0 && (
        <p className="mt-6 text-center text-sm text-muted-text">No published assignments match your filter.</p>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { bulkUpsertAssignmentOverrides } from '@/lib/override-actions'

type SavedOverride = { id: string; student_id: string; student_name: string; due_date: string | null; excused: boolean }

/** "+ Add override" panel: tick one or more students, then excuse them or give them a new due date. */
export default function OverrideStudentChecklist({
  assignmentId,
  courseId,
  students,
  onSaved,
  onCancel,
}: {
  assignmentId: string
  courseId: string
  /** Students who don't already have an override for this assignment */
  students: { id: string; name: string }[]
  onSaved: (overrides: SavedOverride[]) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name))
  const q = filter.trim().toLowerCase()
  const visible = q ? sorted.filter(s => s.name.toLowerCase().includes(q)) : sorted
  const allVisibleSelected = visible.length > 0 && visible.every(s => selected.has(s.id))
  const count = selected.size
  const plural = count === 1 ? 'student' : 'students'

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const toggleAllVisible = () => setSelected(prev => {
    const next = new Set(prev)
    for (const s of visible) {
      if (allVisibleSelected) next.delete(s.id)
      else next.add(s.id)
    }
    return next
  })

  const save = async (excused: boolean) => {
    if (count === 0 || (!excused && !dueDate)) return
    setSaving(true)
    setError(null)
    const due = excused ? null : dueDate
    const result = await bulkUpsertAssignmentOverrides(assignmentId, [...selected], courseId, due, excused)
    setSaving(false)
    if (result.error || !result.overrides) { setError(result.error ?? 'Failed to save'); return }
    const nameById = new Map(students.map(s => [s.id, s.name]))
    onSaved(result.overrides.map(o => ({
      id: o.id,
      student_id: o.student_id,
      student_name: nameById.get(o.student_id) ?? 'Unknown',
      due_date: due,
      excused,
    })))
  }

  if (students.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-border p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-text">Every student already has an override.</p>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-text hover:text-dark-text">Close</button>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-lg border border-border p-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {students.length > 8 && (
          <input
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter students…"
            aria-label="Filter students"
            className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text placeholder:text-muted-text"
          />
        )}
        <button type="button" onClick={toggleAllVisible} className="text-xs text-teal-primary hover:underline shrink-0 ml-auto">
          {allVisibleSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>

      <fieldset>
        <legend className="sr-only">Students</legend>
        <ul className="max-h-64 overflow-y-auto flex flex-col border border-border rounded-lg bg-background divide-y divide-border">
          {visible.map(s => (
            <li key={s.id}>
              <label className="flex items-center gap-2.5 px-3 py-2 text-sm text-dark-text cursor-pointer hover:bg-surface">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="accent-teal-primary"
                />
                {s.name}
              </label>
            </li>
          ))}
          {visible.length === 0 && <li className="px-3 py-2 text-sm text-muted-text">No students match.</li>}
        </ul>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={count === 0 || saving}
          className="badge-amber text-xs font-medium px-3 py-2 rounded-lg border transition-colors whitespace-nowrap disabled:opacity-40"
        >
          {saving ? 'Saving…' : count > 0 ? `+ Excuse ${count} ${plural}` : '+ Excuse'}
        </button>
        <span className="text-xs text-muted-text">or</span>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          aria-label="Custom due date for selected students"
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text"
        />
        <button
          type="button"
          onClick={() => save(false)}
          disabled={count === 0 || !dueDate || saving}
          className="px-3 py-1.5 text-sm font-semibold bg-teal-primary text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
        >
          Set due date
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-text hover:text-dark-text">
          Cancel
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

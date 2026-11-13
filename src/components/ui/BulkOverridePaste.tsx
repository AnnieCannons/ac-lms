'use client'
import { useState } from 'react'
import { bulkUpsertAssignmentOverrides } from '@/lib/override-actions'
import { matchStudentNames } from '@/lib/override-name-match'

type SavedOverride = { id: string; student_id: string; student_name: string; due_date: string | null; excused: boolean }

/** "Paste names" panel for excusing (or re-dating) a group of students at once. */
export default function BulkOverridePaste({
  assignmentId,
  courseId,
  students,
  existingStudentIds,
  onSaved,
  onCancel,
}: {
  assignmentId: string
  courseId: string
  students: { id: string; name: string }[]
  existingStudentIds: ReadonlySet<string>
  onSaved: (overrides: SavedOverride[]) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { matched, ambiguous, unmatched } = matchStudentNames(text, students)
  const replacing = matched.filter(m => existingStudentIds.has(m.student.id)).length
  const count = matched.length
  const plural = count === 1 ? 'student' : 'students'

  const save = async (excused: boolean) => {
    if (count === 0 || (!excused && !dueDate)) return
    setSaving(true)
    setError(null)
    const due = excused ? null : dueDate
    const result = await bulkUpsertAssignmentOverrides(assignmentId, matched.map(m => m.student.id), courseId, due, excused)
    setSaving(false)
    if (result.error || !result.overrides) { setError(result.error ?? 'Failed to save'); return }
    const nameById = new Map(matched.map(m => [m.student.id, m.student.name]))
    onSaved(result.overrides.map(o => ({
      id: o.id,
      student_id: o.student_id,
      student_name: nameById.get(o.student_id) ?? 'Unknown',
      due_date: due,
      excused,
    })))
  }

  return (
    <div className="bg-surface rounded-lg border border-border p-3 flex flex-col gap-3">
      <div>
        <label htmlFor="bulk-override-names" className="block text-sm font-medium text-dark-text mb-1">Paste student names</label>
        <p className="text-xs text-muted-text mb-2">One per line, or separated by commas. First names work when only one student has that name.</p>
        <textarea
          id="bulk-override-names"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          autoFocus
          placeholder={'Jane Smith\nAisha Khan\nJosé'}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-y"
        />
      </div>

      {text.trim() && (
        <div className="flex flex-col gap-2 text-sm" aria-live="polite">
          {count > 0 && (
            <div>
              <p className="text-xs font-semibold text-dark-text mb-1">✅ Matched {count} {plural}</p>
              <ul className="flex flex-wrap gap-1.5">
                {matched.map(m => (
                  <li key={m.student.id} className="text-xs bg-background border border-border rounded-full px-2 py-0.5 text-dark-text">
                    {m.student.name}
                    {existingStudentIds.has(m.student.id) && <span className="text-muted-text"> · replaces override</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ambiguous.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ More than one student matches — use the full name</p>
              <ul className="flex flex-col gap-0.5">
                {ambiguous.map(a => (
                  <li key={a.input} className="text-xs text-muted-text">
                    &ldquo;{a.input}&rdquo; could be {a.candidates.map(c => c.name).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {unmatched.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Not found in this course</p>
              <p className="text-xs text-muted-text">{unmatched.join(', ')}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={count === 0 || saving}
          className="badge-amber text-xs font-medium px-3 py-2 rounded-lg border transition-colors whitespace-nowrap disabled:opacity-40"
        >
          {saving ? 'Saving…' : `+ Excuse ${count || ''} ${plural}`.replace('  ', ' ')}
        </button>
        <span className="text-xs text-muted-text">or</span>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          aria-label="Custom due date for all matched students"
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
      {replacing > 0 && (
        <p className="text-xs text-muted-text">{replacing} of these already {replacing === 1 ? 'has an override' : 'have overrides'}, which will be replaced.</p>
      )}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

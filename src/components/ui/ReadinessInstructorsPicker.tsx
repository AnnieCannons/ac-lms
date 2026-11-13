'use client'

import { useState } from 'react'

export type StaffOption = { id: string; name: string | null; email: string }

/**
 * Picks a course's actual instructors for readiness/accountability messages.
 * Stored on courses.readiness_instructor_ids, separate from enrollments.
 */
export default function ReadinessInstructorsPicker({
  options,
  selected,
  onChange,
  loading = false,
}: {
  options: StaffOption[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  loading?: boolean
}) {
  const [search, setSearch] = useState('')

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const q = search.trim().toLowerCase()
  const filtered = options.filter(o =>
    !q || (o.name?.toLowerCase().includes(q) ?? false) || o.email.toLowerCase().includes(q),
  )

  return (
    <div>
      <label className="block text-sm font-medium text-dark-text mb-1">Accountability Instructors</label>
      <p className="text-xs text-muted-text mb-2">
        Who actually teaches this course? They&apos;re added to step 3 accountability group DMs with the student
        (Catie, Robyn and Dawn are always included) and to the 48-hour overdue check-in reminder.
      </p>
      {loading ? (
        <p className="text-sm text-muted-text">Loading…</p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary mb-2"
          />
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1 border border-border rounded-lg p-2">
            {filtered.map(o => (
              <label key={o.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-border/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="accent-teal-primary"
                />
                <span className="text-sm text-dark-text">{o.name ?? o.email}</span>
                {o.name && <span className="text-xs text-muted-text">{o.email}</span>}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-text px-2 py-1">
                {options.length === 0 ? 'No instructors found.' : 'No matches.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

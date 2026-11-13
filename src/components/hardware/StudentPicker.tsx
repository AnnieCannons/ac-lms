'use client'

import { useId, useRef, useState } from 'react'
import { searchHardwareStudents } from '@/lib/hardware-actions'
import type { Person } from '@/lib/hardware-server'
import { inputCls, labelCls } from './DeviceForm'

/** Type a name or email, pick a student from the matches. */
export default function StudentPicker({
  value,
  onChange,
  label = 'Student',
}: {
  value: Person | null
  onChange: (p: Person | null) => void
  label?: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [searching, setSearching] = useState(false)
  const listId = useId()

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef('')

  // Debounced search from the input's change handler (not an effect), ignoring stale replies.
  function onType(text: string) {
    setQ(text)
    latest.current = text
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 2) { setResults([]); setSearching(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      const res = await searchHardwareStudents(text)
      if (latest.current !== text) return
      setSearching(false)
      setResults(res.ok ? res.students : [])
    }, 250)
  }

  if (value) {
    return (
      <div>
        <p className={labelCls}>{label}</p>
        <div className="mt-1 flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <span className="text-dark-text font-medium">{value.name ?? value.email}</span>
          <span className="text-muted-text truncate">{value.email}</span>
          <button type="button" onClick={() => { onChange(null); onType('') }} className="ml-auto text-xs font-semibold text-teal-primary hover:underline">
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className={labelCls}>
        {label}
        <input
          className={`${inputCls} mt-1`}
          value={q}
          onChange={e => onType(e.target.value)}
          placeholder="Type a name or email"
          aria-controls={listId}
          autoComplete="off"
        />
      </label>
      <div id={listId} aria-live="polite">
        {searching && <p className="text-xs text-muted-text mt-1">Searching…</p>}
        {!searching && q.trim().length >= 2 && results.length === 0 && <p className="text-xs text-muted-text mt-1">No students match.</p>}
        {results.length > 0 && (
          <ul className="mt-1 rounded-lg border border-border divide-y divide-border overflow-hidden">
            {results.map(p => (
              <li key={p.id}>
                <button type="button" onClick={() => onChange(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-border/20 focus:bg-border/20 focus:outline-none">
                  <span className="text-dark-text">{p.name ?? p.email}</span>
                  <span className="text-muted-text"> · {p.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

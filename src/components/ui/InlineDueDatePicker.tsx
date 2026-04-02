'use client'
import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { updateAssignmentDueDate } from '@/lib/assignment-actions'
import { localDate, formatDueDate } from '@/lib/date-utils'

export default function InlineDueDatePicker({ assignmentId, dueDate, onSaved }: {
  assignmentId: string
  dueDate: string | null
  onSaved: (date: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const popW = 300; const popH = 320
    const left = Math.min(r.left, window.innerWidth - popW - 8)
    const top = window.innerHeight - r.bottom < popH ? Math.max(8, r.top - popH - 6) : r.bottom + 4
    setPos({ top, left: Math.max(8, left) })
    setOpen(v => !v)
  }

  async function handleSelect(day: Date | undefined) {
    setOpen(false)
    setSaving(true)
    const val = day ? format(day, 'yyyy-MM-dd') : null
    await updateAssignmentDueDate(assignmentId, val)
    onSaved(val)
    setSaving(false)
  }

  const selected = dueDate ? new Date(dueDate) : undefined
  const label = dueDate
    ? `Due ${new Date(dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`
    : 'Add due date'

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`text-xs hover:text-teal-primary transition-colors ${dueDate ? 'text-muted-text' : 'text-muted-text/60 italic'} ${saving ? 'opacity-50' : ''}`}
        title="Click to edit due date"
      >
        {saving ? 'Saving…' : label}
      </button>
      {open && (
        <div
          ref={popRef}
          className="fixed z-50 bg-surface border border-border rounded-2xl shadow-lg p-2"
          style={{ top: pos.top, left: pos.left }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            components={{
              Chevron: ({ orientation }: { orientation?: string }) => (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--color-dark-text)' }}>
                  {orientation === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
                </svg>
              ),
            }}
            classNames={{
              root: 'text-sm', months: 'flex', month: 'relative space-y-2',
              month_caption: 'flex items-center justify-center px-8 py-1',
              caption_label: 'text-sm font-semibold text-dark-text',
              nav: 'absolute top-0 left-0 right-0 flex items-center justify-between z-10',
              button_previous: 'p-2 rounded-lg hover:bg-teal-light text-dark-text transition-colors',
              button_next: 'p-2 rounded-lg hover:bg-teal-light text-dark-text transition-colors',
              month_grid: 'w-full', weekdays: 'flex',
              weekday: 'w-9 text-center text-xs text-muted-text py-1',
              week: 'flex', day: 'w-9 h-9',
              day_button: 'w-full h-full flex items-center justify-center rounded-lg text-sm text-dark-text hover:bg-teal-light hover:text-teal-primary transition-colors',
              selected: '[&>button]:bg-teal-primary [&>button]:text-white [&>button]:hover:bg-teal-primary [&>button]:hover:text-white',
              today: '[&>button]:font-bold [&>button]:text-teal-primary',
              outside: 'opacity-30',
            }}
          />
          {dueDate && (
            <div className="border-t border-border pt-2 mt-1 px-2">
              <button type="button" onClick={() => handleSelect(undefined)} className="text-xs text-muted-text hover:text-red-500 transition-colors">
                Clear date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

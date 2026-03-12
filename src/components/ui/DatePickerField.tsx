'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parseISO } from 'date-fns'

export default function DatePickerField({
  label,
  value,
  onChange,
  withTime = false,
  placeholder = 'Pick a date',
  className,
  dropUp = false,
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  withTime?: boolean
  placeholder?: string
  className?: string
  dropUp?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  const datePart = withTime ? value.split('T')[0] : value
  const timePart = withTime ? (value.split('T')[1] ?? '23:59') : ''

  const selected = datePart ? parseISO(datePart) : undefined

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const popW = 300
      const popH = 320
      const left = Math.min(r.left, window.innerWidth - popW - 8)
      const spaceBelow = window.innerHeight - r.bottom
      const top = (dropUp || spaceBelow < popH)
        ? Math.max(8, r.top - popH - 6)
        : r.bottom + 4
      setPos({ top, left: Math.max(8, left) })
    }
    setOpen(true)
  }

  function handleDateSelect(day: Date | undefined) {
    if (!day) {
      onChange('')
    } else {
      const formatted = format(day, 'yyyy-MM-dd')
      onChange(withTime ? `${formatted}T${timePart || '23:59'}` : formatted)
    }
    setOpen(false)
  }

  function handleTimeChange(t: string) {
    if (!datePart) return
    onChange(`${datePart}T${t}`)
  }

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-dark-text mb-1">{label}</label>}
      <div ref={ref} className="relative">
        <div className="flex items-center gap-2">
          <button
            ref={btnRef}
            type="button"
            onClick={handleOpen}
            className="flex-1 w-full flex items-center justify-between border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary hover:border-teal-primary transition-colors"
          >
            <span className={selected ? 'text-dark-text' : 'text-muted-text'}>
              {selected ? format(selected, 'MMM d, yyyy') : placeholder}
            </span>
            <svg className="w-4 h-4 text-muted-text shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          {withTime && (
            <input
              type="time"
              value={timePart}
              onChange={e => handleTimeChange(e.target.value)}
              className="border border-border rounded-lg px-2 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary w-28"
            />
          )}
        </div>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 bg-surface border border-border rounded-2xl shadow-lg p-2"
              style={{ top: pos.top, left: pos.left }}
            >
              <DayPicker
                mode="single"
                selected={selected}
                onSelect={handleDateSelect}
                defaultMonth={selected}
                components={{
                  Chevron: ({ orientation }: { orientation?: string }) => (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--color-dark-text)' }}>
                      {orientation === 'left'
                        ? <polyline points="15 18 9 12 15 6" />
                        : <polyline points="9 18 15 12 9 6" />}
                    </svg>
                  ),
                }}
                classNames={{
                  root: 'text-sm',
                  months: 'flex',
                  month: 'relative space-y-2',
                  month_caption: 'flex items-center justify-center px-8 py-1',
                  caption_label: 'text-sm font-semibold text-dark-text',
                  nav: 'absolute top-0 left-0 right-0 flex items-center justify-between z-10',
                  button_previous: 'p-2 rounded-lg hover:bg-teal-light text-dark-text transition-colors',
                  button_next: 'p-2 rounded-lg hover:bg-teal-light text-dark-text transition-colors',
                  month_grid: 'w-full',
                  weekdays: 'flex',
                  weekday: 'w-9 text-center text-xs text-muted-text py-1',
                  week: 'flex',
                  day: 'w-9 h-9',
                  day_button: 'w-full h-full flex items-center justify-center rounded-lg text-sm text-dark-text hover:bg-teal-light hover:text-teal-primary transition-colors',
                  selected: '[&>button]:bg-teal-primary [&>button]:text-white [&>button]:hover:bg-teal-primary [&>button]:hover:text-white',
                  today: '[&>button]:font-bold [&>button]:text-teal-primary',
                  outside: 'opacity-30',
                  disabled: 'opacity-30 cursor-not-allowed',
                }}
              />
              {selected && (
                <div className="border-t border-border pt-2 mt-1 px-2">
                  <button
                    type="button"
                    onClick={() => { onChange(''); setOpen(false) }}
                    className="text-xs text-muted-text hover:text-red-500 transition-colors"
                  >
                    Clear date
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

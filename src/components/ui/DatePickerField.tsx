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
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  withTime?: boolean
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
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
            type="button"
            onClick={() => setOpen(v => !v)}
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
          <div className="absolute z-50 mt-1 bg-surface border border-border rounded-2xl shadow-lg p-2">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleDateSelect}
              defaultMonth={selected}
              classNames={{
                root: 'text-sm',
                months: 'flex',
                month: 'relative space-y-2',
                month_caption: 'flex items-center justify-center px-8 py-1',
                caption_label: 'text-sm font-semibold text-dark-text',
                nav: 'absolute top-0 left-0 right-0 flex items-center justify-between pointer-events-none',
                button_previous: 'pointer-events-auto p-1 rounded-lg hover:bg-teal-light text-teal-primary hover:opacity-70 transition-colors',
                button_next: 'pointer-events-auto p-1 rounded-lg hover:bg-teal-light text-teal-primary hover:opacity-70 transition-colors',
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
        )}
      </div>
    </div>
  )
}

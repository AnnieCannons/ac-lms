'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import Modal from './Modal'
import { updateCourseDates } from '@/lib/course-actions'

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? parseISO(value) : undefined

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div>
      <label className="block text-sm font-medium text-dark-text mb-1">{label}</label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between border border-border rounded-lg px-3 py-2.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary hover:border-teal-primary transition-colors"
        >
          <span className={selected ? 'text-dark-text' : 'text-muted-text'}>
            {selected ? format(selected, 'MMM d, yyyy') : 'Pick a date'}
          </span>
          <svg className="w-4 h-4 text-muted-text shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 bg-surface border border-border rounded-2xl shadow-lg p-2">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={day => {
                onChange(day ? format(day, 'yyyy-MM-dd') : '')
                setOpen(false)
              }}
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

export default function EditCourseDatesButton({
  courseId,
  initialStartDate,
  initialEndDate,
}: {
  courseId: string
  initialStartDate: string | null
  initialEndDate: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(initialStartDate ?? '')
  const [endDate, setEndDate] = useState(initialEndDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateCourseDates(courseId, startDate || null, endDate || null)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(null) }}
        className="text-xs text-muted-text hover:text-teal-primary transition-colors shrink-0"
      >
        Edit Dates
      </button>

      {open && (
        <Modal title="Edit Course Dates" onClose={() => !saving && setOpen(false)} maxWidth="max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DatePickerField label="Start Date" value={startDate} onChange={setStartDate} />
            <DatePickerField label="End Date" value={endDate} onChange={setEndDate} />
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="text-sm text-muted-text hover:text-dark-text transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

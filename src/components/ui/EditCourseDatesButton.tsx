'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import { updateCourseDates } from '@/lib/course-actions'
import DatePickerField from './DatePickerField'

const MONTH_CYCLE: Record<string, { next: string; yearDelta: number }> = {
  Jan:  { next: 'May',  yearDelta: 0 },
  May:  { next: 'Sept', yearDelta: 0 },
  Sept: { next: 'Jan',  yearDelta: 1 },
}

function advanceAirtableName(name: string): string | null {
  const match = name.match(/^(Jan|May|Sept) (\d{4}) - (.+)$/)
  if (!match) return null
  const [, month, year, rest] = match
  const cycle = MONTH_CYCLE[month]
  if (!cycle) return null
  return `${cycle.next} ${parseInt(year) + cycle.yearDelta} - ${rest}`
}

export default function EditCourseDatesButton({
  courseId,
  initialStartDate,
  initialEndDate,
  initialAirtableCourseName,
}: {
  courseId: string
  initialStartDate: string | null
  initialEndDate: string | null
  initialAirtableCourseName: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState(initialStartDate ?? '')
  const [endDate, setEndDate] = useState(initialEndDate ?? '')
  const [airtableName, setAirtableName] = useState(initialAirtableCourseName ?? '')
  const [airtableNameDirty, setAirtableNameDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestion = initialAirtableCourseName ? advanceAirtableName(initialAirtableCourseName) : null

  const handleOpen = () => {
    setStartDate(initialStartDate ?? '')
    setEndDate(initialEndDate ?? '')
    setAirtableName(initialAirtableCourseName ?? '')
    setAirtableNameDirty(false)
    setError(null)
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await updateCourseDates(
      courseId,
      startDate || null,
      endDate || null,
      airtableName || null,
    )
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-muted-text hover:text-teal-primary transition-colors shrink-0"
      >
        Edit Dates
      </button>

      {open && (
        <Modal title="Edit Course Dates" onClose={() => !saving && setOpen(false)} maxWidth="max-w-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DatePickerField label="Start Date" value={startDate} onChange={setStartDate} />
            <DatePickerField label="End Date" value={endDate} onChange={setEndDate} />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-dark-text">Airtable Course Name</label>
              <input
                type="text"
                value={airtableName}
                onChange={e => {
                  setAirtableName(e.target.value)
                  setAirtableNameDirty(true)
                }}
                placeholder="e.g. May 2026 - Advanced Frontend"
                className="border border-border rounded-lg px-3 py-2 text-sm text-dark-text bg-background focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
              {suggestion && !airtableNameDirty && (
                <p className="text-xs text-muted-text">
                  Next cohort:{' '}
                  <button
                    type="button"
                    onClick={() => setAirtableName(suggestion)}
                    className="text-teal-primary hover:underline"
                  >
                    {suggestion}
                  </button>
                </p>
              )}
              {airtableNameDirty && (
                <p className="text-xs text-amber-600">
                  ⚠ Make sure this matches your Airtable course name exactly.
                </p>
              )}
            </div>

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

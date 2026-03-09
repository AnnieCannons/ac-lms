'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from './Modal'
import { updateCourseDates } from '@/lib/course-actions'
import DatePickerField from './DatePickerField'

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

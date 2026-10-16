'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setMyCuttingEdgeRsvp } from '@/lib/cutting-edge-actions'
import { CUTTING_EDGE_TASKS_CHANGED, type RsvpResponse } from '@/lib/cutting-edge'

export default function StudentRsvp({
  courseId,
  eventId,
  response,
  locked,
  canAct,
}: {
  courseId: string
  eventId: string
  response: RsvpResponse | null
  locked: boolean
  canAct: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(next: RsvpResponse) {
    setBusy(true); setError(null)
    const res = await setMyCuttingEdgeRsvp(courseId, eventId, next)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    // Saying yes takes them straight to the question they need to submit.
    if (next === 'yes') router.push(`/student/courses/${courseId}/cutting-edge-talks/${eventId}/question`)
    window.dispatchEvent(new Event(CUTTING_EDGE_TASKS_CHANGED))
    router.refresh()
  }

  const btn = (value: RsvpResponse, label: string) => {
    const selected = response === value
    return (
      <button
        type="button"
        aria-pressed={selected}
        disabled={busy || locked || !canAct}
        onClick={() => choose(value)}
        className={`px-5 py-2 rounded-full text-sm font-semibold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          selected ? 'bg-teal-primary text-white border-teal-primary' : 'border-border text-dark-text hover:border-teal-primary'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      <p className="text-sm font-semibold text-dark-text mb-2">Are you coming?</p>
      <div className="flex flex-wrap gap-2">
        {btn('yes', 'Yes, I’ll be there')}
        {btn('no', 'No, I can’t make it')}
      </div>
      <p className="text-xs text-muted-text mt-2">
        {locked
          ? 'RSVPs closed when the talk started.'
          : !canAct
            ? 'RSVPs are off while previewing.'
            : 'You can change your answer any time before the talk — please do if your plans change.'}
      </p>
      {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

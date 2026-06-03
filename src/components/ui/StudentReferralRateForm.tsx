'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRating } from '@/lib/partner-ratings-actions'

interface Props {
  referralId: string
  partnerId: string
  partnerName: string
  serviceCategory: string
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Not helpful',
  2: 'Somewhat helpful',
  3: 'Helpful',
  4: 'Very helpful',
  5: 'Excellent',
}

export default function StudentReferralRateForm({
  referralId,
  partnerId,
  partnerName,
  serviceCategory,
}: Props) {
  const router = useRouter()
  const [score, setScore] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!score) return
    setSaving(true)
    setError(null)

    const result = await createRating({
      partner_id: partnerId,
      referral_id: referralId,
      service_category: serviceCategory,
      score,
      notes: notes.trim() || null,
      reviewer_type: 'student',
    })

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/student/courses'), 2500)
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center flex flex-col items-center gap-4">
        <div className="text-5xl text-yellow-400">★</div>
        <h2 className="text-lg font-bold text-dark-text">Thank you for your feedback!</h2>
        <p className="text-sm text-muted-text">
          Your rating for <span className="font-medium text-dark-text">{partnerName}</span> has been submitted. This helps us improve our partnerships.
        </p>
        <p className="text-xs text-muted-text">Redirecting you to your courses…</p>
      </div>
    )
  }

  const displayScore = hovered ?? score

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-surface px-6 py-6 flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-dark-text">
          How would you rate your experience? <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(null)}
              className={`text-3xl leading-none transition-colors ${
                n <= (displayScore ?? 0) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
              } hover:text-yellow-300 cursor-pointer`}
              aria-label={`${n} star${n !== 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>
        {displayScore && (
          <p className="text-sm text-muted-text">{SCORE_LABELS[displayScore]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-dark-text" htmlFor="notes">
          Any additional comments? <span className="text-muted-text font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="Tell us more about how this referral went…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !score}
          className="px-5 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Submitting…' : 'Submit Rating'}
        </button>
        <a
          href="/student/courses"
          className="px-5 py-2 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary transition-colors"
        >
          Skip
        </a>
      </div>
    </form>
  )
}

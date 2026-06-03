'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRating } from '@/lib/partner-ratings-actions'
import { SERVICE_CATEGORIES } from '@/lib/service-categories'

interface Props {
  referralId: string
  partnerId: string
  partnerName: string
  serviceCategories: string[]
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Not helpful',
  2: 'Somewhat helpful',
  3: 'Helpful',
  4: 'Very helpful',
  5: 'Excellent',
}

interface ServiceRating {
  id: string
  category: string
  score: number | null
  hovered: number | null
  notes: string
}

function StarRating({
  score,
  hovered,
  onScore,
  onHover,
  onLeave,
}: {
  score: number | null
  hovered: number | null
  onScore: (n: number) => void
  onHover: (n: number) => void
  onLeave: () => void
}) {
  const displayScore = hovered ?? score
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onScore(n)}
            onMouseEnter={() => onHover(n)}
            onMouseLeave={onLeave}
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
        <p className="text-xs text-muted-text">{SCORE_LABELS[displayScore]}</p>
      )}
    </div>
  )
}

let nextId = 1

export default function StudentReferralRateForm({
  referralId,
  partnerId,
  partnerName,
  serviceCategories,
}: Props) {
  const router = useRouter()
  const [ratings, setRatings] = useState<ServiceRating[]>(
    serviceCategories.map((cat, i) => ({
      id: i === 0 ? 'primary' : `pre-${i}`,
      category: cat,
      score: null,
      hovered: null,
      notes: '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function updateRating(id: string, patch: Partial<ServiceRating>) {
    setRatings(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function addService() {
    const usedCategories = ratings.map(r => r.category)
    const available = SERVICE_CATEGORIES.find(c => !usedCategories.includes(c))
    setRatings(prev => [
      ...prev,
      {
        id: `extra-${nextId++}`,
        category: available ?? SERVICE_CATEGORIES[0],
        score: null,
        hovered: null,
        notes: '',
      },
    ])
  }

  function removeService(id: string) {
    setRatings(prev => prev.filter(r => r.id !== id))
  }

  const allScored = ratings.every(r => r.score !== null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allScored) return
    setSaving(true)
    setError(null)

    for (const rating of ratings) {
      const result = await createRating({
        partner_id: partnerId,
        referral_id: referralId,
        service_category: rating.category,
        score: rating.score!,
        notes: rating.notes.trim() || null,
        reviewer_type: 'student',
      })
      if (result.error) {
        setError(result.error)
        setSaving(false)
        return
      }
    }

    setSaving(false)
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

  const usedCategories = ratings.map(r => r.category)
  const canAddMore = ratings.length < SERVICE_CATEGORIES.length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {ratings.map((rating, index) => (
        <div
          key={rating.id}
          className="rounded-xl border border-border bg-surface px-6 py-5 flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 flex-1">
              {!rating.id.startsWith('extra') ? (
                <p className="text-sm font-semibold text-dark-text">{rating.category}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-text uppercase tracking-wide">
                    Service
                  </label>
                  <select
                    value={rating.category}
                    onChange={e => updateRating(rating.id, { category: e.target.value })}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  >
                    {SERVICE_CATEGORIES.map(cat => (
                      <option
                        key={cat}
                        value={cat}
                        disabled={usedCategories.includes(cat) && cat !== rating.category}
                      >
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {rating.id !== 'primary' && (
              <button
                type="button"
                onClick={() => removeService(rating.id)}
                className="text-muted-text hover:text-red-500 text-sm transition-colors mt-0.5"
                aria-label="Remove this service"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              How helpful was this service? <span className="text-red-500">*</span>
            </label>
            <StarRating
              score={rating.score}
              hovered={rating.hovered}
              onScore={n => updateRating(rating.id, { score: n })}
              onHover={n => updateRating(rating.id, { hovered: n })}
              onLeave={() => updateRating(rating.id, { hovered: null })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              Additional comments{' '}
              <span className="text-muted-text font-normal">(optional)</span>
            </label>
            <textarea
              value={rating.notes}
              onChange={e => updateRating(rating.id, { notes: e.target.value })}
              rows={3}
              placeholder="Tell us more about how this service helped…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
            />
          </div>
        </div>
      ))}

      {canAddMore && (
        <button
          type="button"
          onClick={addService}
          className="text-sm text-teal-primary font-medium hover:underline text-left"
        >
          + Rate another service
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !allScored}
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

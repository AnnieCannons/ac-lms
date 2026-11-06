'use client'
import { useState } from 'react'
import Confetti from './Confetti'
import { setGoalClaim } from '@/lib/assignment-series-actions'

interface Props {
  assignmentId: string
  courseId: string
  label: string
  initialClaimed: boolean
  confirmed: boolean
  /** How many later weeks the confirmation excused. */
  excusedCount: number
  /** Preview, observers and read-only viewers see it but can't check it. */
  disabled?: boolean
}

/** The student's "I met my goal" checkbox: confetti when checked, flagged for the grader. */
export default function GoalCheckoff({ assignmentId, courseId, label, initialClaimed, confirmed, excusedCount, disabled }: Props) {
  const [claimed, setClaimed] = useState(initialClaimed)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [burst, setBurst] = useState(0)

  async function toggle(next: boolean) {
    setSaving(true); setError(null)
    setClaimed(next)
    if (next) setBurst(b => b + 1)
    const result = await setGoalClaim({ assignmentId, courseId, claimed: next })
    setSaving(false)
    if (result.error) { setClaimed(!next); setError(result.error) }
  }

  return (
    <div className={`rounded-2xl border p-6 ${claimed ? 'border-teal-primary bg-teal-light' : 'border-border bg-surface'}`}>
      <Confetti burst={burst} />
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">Your goal</p>
      <label className={`flex items-start gap-3 ${disabled || confirmed ? '' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={claimed}
          disabled={disabled || confirmed || saving}
          onChange={e => toggle(e.target.checked)}
          className="mt-0.5 w-5 h-5 accent-teal-primary shrink-0"
        />
        <span className="text-sm font-semibold text-dark-text">{label}</span>
      </label>
      <div role="status" className="mt-2 pl-8 text-sm text-dark-text">
        {confirmed ? (
          <p>
            Your instructor confirmed it. Amazing work! <span aria-hidden="true">🎉</span>
            {excusedCount > 0 && ` You're excused from the remaining ${excusedCount} week${excusedCount === 1 ? '' : 's'} of this assignment.`}
          </p>
        ) : claimed ? (
          <p>Way to go! <span aria-hidden="true">🎉</span> Your instructor will see this when they grade and confirm it.</p>
        ) : null}
      </div>
      {error && <p role="alert" className="mt-2 pl-8 text-sm text-red-400">{error}</p>}
    </div>
  )
}

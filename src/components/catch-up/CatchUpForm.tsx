'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitCatchUpForm } from '@/lib/class-catch-up-actions'
import { FIELD_LABELS, FIELD_LIMITS, validateCatchUpInput, type CatchUpInput } from '@/lib/class-catch-up'

const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'

const HINTS: Partial<Record<keyof CatchUpInput, string>> = {
  missedBlocks: 'For example: Blocks C and D on Wednesday, September 23, and Blocks A & B on Thursday, September 24',
  lecturesMissed: 'You can find the daily agenda in Slack.',
  lectureLinks: 'Please include the names and the links to the lectures. The link to the recordings is in your class Slack channel.',
  assignmentsMissed: 'Check the Course Outline in the LMS.',
  makeupPlan: 'For example:\n- Lecture videos will be completed by [date/time]\n- Assignment A will be completed by [date/time]\n- Assignment B, etc.',
}

const ORDER: (keyof CatchUpInput)[] = ['missedBlocks', 'lecturesMissed', 'lectureLinks', 'assignmentsMissed', 'makeupPlan', 'notes']

/** The Class Catch Up Form (rebuilt from the Airtable form). Name, email and class come from the account. */
export default function CatchUpForm({
  courseId,
  absenceDate,
  initialMissedBlocks,
  disabled,
}: {
  courseId: string
  absenceDate: string | null
  initialMissedBlocks: string
  /** Preview / view-as: show the form but don't let it be sent. */
  disabled?: boolean
}) {
  const router = useRouter()
  const empty: CatchUpInput = { missedBlocks: initialMissedBlocks, lecturesMissed: '', lectureLinks: '', assignmentsMissed: '', makeupPlan: '', notes: '' }
  const [form, setForm] = useState<CatchUpInput>(empty)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    const checked = validateCatchUpInput(form)
    if ('error' in checked) { setError(checked.error); return }
    setBusy(true)
    setError(null)
    const res = await submitCatchUpForm(courseId, form, absenceDate)
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    setSent(true)
    setForm({ ...empty, missedBlocks: '' })
    router.refresh()
  }

  if (sent) {
    return (
      <div role="status" className="bg-surface rounded-2xl border border-teal-primary p-6 flex flex-col gap-3">
        <p className="text-base font-bold text-dark-text"><span aria-hidden="true">✓ </span>Thank you! Your catch-up form is sent.</p>
        <p className="text-sm text-muted-text">Your instructor will follow up with you about your plan.</p>
        <div>
          <button type="button" onClick={() => setSent(false)} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
            Fill out another one
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-5" noValidate>
      {ORDER.map(key => {
        const id = `catch-up-${key}`
        const hintId = HINTS[key] ? `${id}-hint` : undefined
        const required = key !== 'notes'
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-semibold text-dark-text">
              {FIELD_LABELS[key]}
              {required && <span className="text-red-600" aria-hidden="true"> *</span>}
            </label>
            {hintId && <p id={hintId} className="text-xs text-muted-text whitespace-pre-line">{HINTS[key]}</p>}
            <textarea
              id={id}
              rows={key === 'missedBlocks' ? 2 : key === 'notes' ? 3 : 4}
              className={inputCls}
              value={form[key] ?? ''}
              maxLength={FIELD_LIMITS[key]}
              required={required}
              aria-required={required}
              aria-describedby={hintId}
              disabled={disabled}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        )
      })}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div>
        <button type="submit" disabled={busy || disabled} className="bg-teal-primary text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Sending…' : 'Send my catch-up form'}
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { answerWhatHelped } from '@/lib/goal-met-actions'
import { OTHER_TEXT_MAX_LENGTH, OWN_PLAN_VALUE, WHAT_HELPED_OPTIONS } from '@/lib/confidence-tracker-validation'

interface Props {
  outcomeId: string
  skillName: string
  // The student's own study-plan "Other" text for this goal, offered as one more choice.
  ownPlanText: string | null
  onAnswered: () => void
  // "Skip for now" — treated exactly like walking away: the question stays answerable later.
  onSkip: () => void
}

// Optional multi-select "what helped you reach this goal?" (Confidence Tracker v2, Phase 6).
// Shared by the post-submit celebration and the follow-up on My Skill Confidence.
export default function WhatHelpedForm({ outcomeId, skillName, ownPlanText, onAnswered, onSkip }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [other, setOther] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const options: { value: string; label: string }[] = [...WHAT_HELPED_OPTIONS]
  if (ownPlanText && ownPlanText.trim()) {
    // Before "Other" so the write-in option stays last.
    options.splice(options.length - 1, 0, { value: OWN_PLAN_VALUE, label: ownPlanText })
  }

  const includesOther = selected.includes('other')
  const canSave = selected.length > 0 && (!includesOther || other.trim() !== '')

  function toggle(value: string) {
    setSelected(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
    if (value === 'other' && selected.includes('other')) setOther('')
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await answerWhatHelped(outcomeId, selected, includesOther ? other : undefined)
      if (result.error) {
        setError(result.error)
        return
      }
      // Answering marks the reminder read server-side; tell the bell to refetch so it shows that now.
      window.dispatchEvent(new Event('notifications-updated'))
      onAnswered()
    })
  }

  const labelId = `what-helped-label-${outcomeId}`
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-dark-text">
        {/* The skill name is already in the heading above; keep it for screen readers so several questions stay distinguishable. */}
        What helped you reach your goal? (choose all that apply){' '}
        <span className="sr-only">for {skillName}</span>
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
        {options.map(opt => {
          const checked = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={checked}
              disabled={pending}
              onClick={() => toggle(opt.value)}
              className="flex items-start gap-3 py-1 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span
                aria-hidden="true"
                className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  checked ? 'bg-teal-primary border-teal-primary' : 'border-muted-text group-hover:border-teal-primary'
                }`}
              >
                {checked && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="text-sm text-dark-text break-words">{opt.label}</span>
            </button>
          )
        })}
      </div>
      {includesOther && (
        <input
          type="text"
          value={other}
          disabled={pending}
          maxLength={OTHER_TEXT_MAX_LENGTH}
          aria-label="Describe what helped"
          placeholder="Describe what helped…"
          onChange={e => setOther(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary disabled:opacity-50"
        />
      )}
      {error && (
        <p role="alert" className="alert-error rounded-lg p-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || pending}
          className="rounded-lg bg-teal-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-text hover:text-dark-text disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

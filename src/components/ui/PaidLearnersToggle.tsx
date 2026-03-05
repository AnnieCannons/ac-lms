'use client'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PaidLearnersToggle({
  courseId,
  initialValue,
}: {
  courseId: string
  initialValue: boolean
}) {
  const [enabled, setEnabled] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      await createClient()
        .from('courses')
        .update({ paid_learners: next })
        .eq('id', courseId)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-dark-text">Paid Learners</p>
          <p className="text-xs text-muted-text mt-0.5">
            Enables Benefits &amp; PTO pages in the student sidebar.
          </p>
        </div>
        {saved && <span className="text-xs text-teal-primary font-medium">✓ Saved</span>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-60 ${
          enabled
            ? 'border-teal-primary bg-teal-light text-teal-primary'
            : 'border-gray-200 text-muted-text hover:border-gray-300'
        }`}
      >
        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
          enabled ? 'bg-teal-primary border-teal-primary' : 'border-gray-400'
        }`}>
          {enabled && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {enabled ? 'Paid learners — Benefits & PTO enabled' : 'Not a paid learner course'}
      </button>
    </div>
  )
}

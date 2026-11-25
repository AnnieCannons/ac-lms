'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setEnrollmentReadiness } from '@/lib/course-actions'

/** "Enrollment Readiness course" checkbox on the instructor General Info page (next to Paid Learners). */
export default function EnrollmentReadinessToggle({
  courseId,
  initialValue,
}: {
  courseId: string
  initialValue: boolean
}) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    setError(null)
    startTransition(async () => {
      const result = await setEnrollmentReadiness(courseId, next)
      if (result.error) {
        setEnabled(!next)
        setError(result.error)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    })
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-dark-text">Enrollment Readiness</p>
          <p className="text-xs text-muted-text mt-0.5">
            Prework for accepted students. Students see a shorter sidebar, and their progress shows on New Student Onboarding.
          </p>
        </div>
        <span aria-live="polite" className="text-xs text-teal-primary font-medium">{saved ? '✓ Saved' : ''}</span>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={enabled}
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
        {enabled ? 'Enrollment Readiness course' : 'Not an Enrollment Readiness course'}
      </button>
      {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markCompleteNoSubmission, saveGrade } from '@/lib/grade-actions'

/**
 * "Mark complete" on the onboarding checklist: grades turned-in work Complete, or checks off
 * a "No submission" assignment. Uses the same actions as the grader, so the student gets the
 * usual notification and finishing is checked the same way.
 */
export default function MarkCompleteButton({
  courseId,
  assignmentId,
  studentId,
  submissionId,
  checkOff,
  title,
}: {
  courseId: string
  assignmentId: string
  studentId: string
  submissionId: string | null
  /** A "No submission" assignment (staff check-off) */
  checkOff: boolean
  title: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mark() {
    setBusy(true)
    setError(null)
    const result = checkOff || !submissionId
      ? await markCompleteNoSubmission(assignmentId, studentId, 'complete', courseId)
      : await saveGrade(submissionId, 'complete', courseId)
    setBusy(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={mark}
        disabled={busy}
        aria-label={`Mark "${title}" complete`}
        className="whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Mark complete'}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  )
}

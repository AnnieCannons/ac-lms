'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmGoalClaim } from '@/lib/assignment-series-actions'
import LocalDateTime from './LocalDateTime'

interface Props {
  assignmentId: string
  courseId: string
  studentId: string
  studentName: string
  label: string
  claimedAt: string
  confirmedAt: string | null
  excusedCount: number
  /** Whether this assignment repeats (so confirming excuses later weeks). */
  repeats: boolean
}

/** Shown to the grader when a student checked "I met my goal": confirm it, or undo a confirmation. */
export default function GoalClaimReview({ assignmentId, courseId, studentId, studentName, label, claimedAt, confirmedAt, excusedCount, repeats }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = studentName.split(' ')[0] || 'This student'

  async function set(confirmed: boolean) {
    if (!confirmed && !confirm(`Undo the confirmation? ${first} will no longer be excused from the later weeks it excused.`)) return
    setSaving(true); setError(null)
    const result = await confirmGoalClaim({ assignmentId, courseId, studentId, confirmed })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    router.refresh()
  }

  return (
    <div role="status" className="rounded-2xl border-2 border-teal-primary bg-teal-light p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">🎯</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-dark-text">
            {confirmedAt ? `You confirmed ${first} met their goal` : `${first} says they met their goal`}
          </p>
          <p className="text-sm text-dark-text mt-0.5">“{label}”</p>
          <p className="text-xs text-muted-text mt-1">
            Checked <LocalDateTime iso={claimedAt} />
            {confirmedAt && repeats && ` · excused from ${excusedCount} later week${excusedCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      {confirmedAt ? (
        <div>
          <button type="button" onClick={() => set(false)} disabled={saving} className="text-xs text-muted-text hover:text-dark-text hover:underline disabled:opacity-50">
            {saving ? 'Undoing…' : 'Undo confirmation'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => set(true)}
            disabled={saving}
            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-teal-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Confirming…' : repeats ? 'Confirm & excuse later weeks' : 'Confirm goal met'}
          </button>
          {repeats && <p className="text-xs text-muted-text">They’ll be excused from every later week of this assignment.</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addFinishersToNextCourse, setOnboardingNextCourse } from '@/lib/onboarding-actions'

/**
 * Where this Enrollment Readiness cohort goes next (usually a Tech Career Foundations course,
 * often created later), and one button to add everyone who has finished.
 */
export default function NextCoursePanel({
  courseId,
  nextCourseId,
  options,
  finished,
  finishedNotThere,
}: {
  courseId: string
  nextCourseId: string | null
  options: { id: string; name: string }[]
  /** Students who have finished */
  finished: number
  /** Finished students not yet enrolled in the next course */
  finishedNotThere: number
}) {
  const router = useRouter()
  const [choice, setChoice] = useState(nextCourseId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const current = options.find(o => o.id === nextCourseId)

  async function save(value: string) {
    setChoice(value)
    setBusy(true)
    setError(null)
    setDone(null)
    const res = await setOnboardingNextCourse(courseId, value || null)
    setBusy(false)
    if (!res.ok) { setChoice(nextCourseId ?? ''); setError(res.error); return }
    router.refresh()
  }

  async function addAll() {
    if (!current) return
    if (!window.confirm(`Add ${finishedNotThere} finished ${finishedNotThere === 1 ? 'student' : 'students'} to ${current.name}?`)) return
    setBusy(true)
    setError(null)
    const res = await addFinishersToNextCourse(courseId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setDone(`Added ${res.added} ${res.added === 1 ? 'student' : 'students'} to ${current.name}.`)
    router.refresh()
  }

  return (
    <section aria-labelledby="next-course-heading" className="bg-surface rounded-2xl border border-border p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="next-course-heading" className="text-sm font-bold text-dark-text">Next course</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Pick it once it exists (usually Tech Career Foundations), then add everyone who has finished.
          </p>
        </div>
        <select
          value={choice}
          disabled={busy}
          onChange={e => save(e.target.value)}
          aria-label="Next course"
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text max-w-full disabled:opacity-60"
        >
          <option value="">Not created yet</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {current && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {finishedNotThere > 0 ? (
            <button type="button" onClick={addAll} disabled={busy} className="bg-teal-primary text-white font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
              {busy ? 'Adding…' : `Add ${finishedNotThere} finished ${finishedNotThere === 1 ? 'student' : 'students'} to ${current.name}`}
            </button>
          ) : (
            <p className="text-muted-text">
              {finished === 0 ? 'Nobody has finished yet.' : `All ${finished} finished ${finished === 1 ? 'student is' : 'students are'} in ${current.name}.`}
            </p>
          )}
        </div>
      )}
      {done && <p role="status" className="mt-2 text-sm text-green-700">{done}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}

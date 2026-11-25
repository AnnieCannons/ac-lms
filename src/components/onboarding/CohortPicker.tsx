'use client'
import { useRouter } from 'next/navigation'

/** Switches the onboarding page between Enrollment Readiness cohorts. */
export default function CohortPicker({ cohorts, selectedId }: { cohorts: { id: string; name: string }[]; selectedId: string }) {
  const router = useRouter()
  if (cohorts.length < 2) return null
  return (
    <label className="flex items-center gap-2 text-sm text-muted-text">
      <span>Cohort</span>
      <select
        value={selectedId}
        onChange={e => router.push(`/instructor/onboarding?course=${e.target.value}`)}
        className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
      >
        {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  )
}

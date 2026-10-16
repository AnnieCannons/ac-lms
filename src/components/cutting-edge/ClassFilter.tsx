'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** "Filter by class" select that keeps the choice in ?course= so it survives drill-down links. */
export default function ClassFilter({ courses, value }: { courses: { id: string; name: string }[]; value?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <label className="flex items-center gap-2 text-sm text-muted-text">
      Class
      <select
        value={value ?? ''}
        onChange={e => {
          const params = new URLSearchParams(searchParams.toString())
          if (e.target.value) params.set('course', e.target.value)
          else params.delete('course')
          const qs = params.toString()
          router.push(qs ? `${pathname}?${qs}` : pathname)
        }}
        className="px-3 py-1.5 rounded-lg border border-border bg-surface text-dark-text text-sm"
      >
        <option value="">All classes</option>
        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  )
}

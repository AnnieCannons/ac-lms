'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ReadinessZoneBadge, READINESS_COLOR } from '@/components/ui/ReadinessWidgets'
import { getMyReadinessPreview } from '@/lib/readiness-actions'
import { summarizeLosses } from '@/lib/readiness-breakdown'
import type { StudentReadinessPreview } from '@/lib/readiness-score'

/**
 * Small "readiness so far this week" card on the student's course home,
 * linking to the full breakdown on Weekly Readiness. Loads after the page
 * (the score pulls live attendance) and renders nothing when the course
 * doesn't use readiness or there's no score this week.
 */
export default function ReadinessPreviewCard({ courseId }: { courseId: string }) {
  const [preview, setPreview] = useState<StudentReadinessPreview | null>(null)

  useEffect(() => {
    let cancelled = false
    getMyReadinessPreview(courseId)
      .then(p => { if (!cancelled) setPreview(p) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [courseId])

  const breakdown = preview?.breakdown
  if (!breakdown) return null
  const losses = summarizeLosses(breakdown)

  return (
    <Link
      href={`/student/readiness?course=${courseId}`}
      className="flex items-center justify-between gap-4 bg-surface border border-border rounded-2xl px-5 py-4 mb-6 hover:border-teal-primary/50 transition-colors"
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-text">Readiness this week so far</div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-2xl font-bold" style={{ color: READINESS_COLOR }}>
            {breakdown.score.toFixed(1)}<span className="text-sm text-muted-text font-normal"> / 5</span>
          </span>
          <ReadinessZoneBadge zone={breakdown.zone} />
        </div>
        {losses && <div className="text-xs text-muted-text mt-1">{losses}</div>}
      </div>
      <span className="text-sm font-medium text-teal-primary shrink-0">See why →</span>
    </Link>
  )
}

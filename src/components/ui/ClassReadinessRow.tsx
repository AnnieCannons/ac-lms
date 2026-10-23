'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import UserAvatar from '@/components/ui/UserAvatar'
import { ReadinessZoneBadge, READINESS_COLOR } from '@/components/ui/ReadinessWidgets'
import ReadinessBreakdownDetails from '@/components/ui/ReadinessBreakdown'
import { summarizeLosses } from '@/lib/readiness-breakdown'
import type { CourseReadinessRow } from '@/lib/readiness-actions'
import type { PreviewWeek } from '@/lib/readiness-score'

function formatBlocksMissed(row: CourseReadinessRow): string {
  const { week } = row
  if (!week || week.blocksTotal == null || week.blocksTotal === 0) return '—'
  return `${week.blocksMissed ?? 0} of ${week.blocksTotal}`
}

/** One student's row on Class Readiness. In the live view, expands to show what's costing them points. */
export default function ClassReadinessRow({ courseId, row, liveWeek }: {
  courseId: string
  row: CourseReadinessRow
  /** Set in the live view, where rows can expand. */
  liveWeek: PreviewWeek | null
}) {
  const [open, setOpen] = useState(false)
  const expandable = !!liveWeek && !!row.breakdown
  const Chevron = open ? ChevronDown : ChevronRight
  const losses = row.breakdown ? summarizeLosses(row.breakdown) : null

  return (
    <Fragment>
      <tr className="bg-background">
        <td className="px-4 py-3 font-medium text-dark-text">
          <div className="flex items-center gap-1">
            {liveWeek && (
              expandable ? (
                <button
                  type="button"
                  onClick={() => setOpen(o => !o)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Hide' : 'Show'} what's costing ${row.name || 'this student'} points`}
                  className="p-0.5 rounded text-muted-text hover:text-teal-primary"
                >
                  <Chevron size={16} />
                </button>
              ) : <span className="w-5" />
            )}
            <Link
              href={`/instructor/courses/${courseId}/roster/${row.studentId}`}
              className="flex items-center gap-2 hover:text-teal-primary hover:underline"
            >
              <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
              {row.name || '—'}
              {row.isTestAccount && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-border/40 text-muted-text">Test</span>
              )}
            </Link>
          </div>
          {losses && (
            <div className={`text-xs font-normal mt-0.5 text-red-700 ${liveWeek ? 'pl-6' : ''}`}>{losses}</div>
          )}
        </td>
        <td className="px-4 py-3">
          {row.week?.score != null ? (
            <span className="font-bold" style={{ color: READINESS_COLOR }}>
              {row.week.score.toFixed(1)}<span className="text-xs text-muted-text font-normal">/5</span>
            </span>
          ) : (
            <span className="text-muted-text">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <ReadinessZoneBadge zone={row.week?.zone ?? null} />
        </td>
        <td className="px-4 py-3 text-dark-text">{row.week?.missing ?? '—'}</td>
        <td className="px-4 py-3 text-dark-text">{row.week?.needsRevision ?? '—'}</td>
        <td className="px-4 py-3 text-dark-text">{formatBlocksMissed(row)}</td>
      </tr>
      {expandable && open && (
        <tr className="bg-surface/40">
          <td colSpan={6} className="px-4 py-4 pl-12">
            <ReadinessBreakdownDetails breakdown={row.breakdown!} week={liveWeek!} audience="staff" />
          </td>
        </tr>
      )}
    </Fragment>
  )
}

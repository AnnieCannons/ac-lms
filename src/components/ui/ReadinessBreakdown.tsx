'use client'

import Link from 'next/link'
import { CalendarX, FileX, RotateCcw, type LucideIcon } from 'lucide-react'
import { MISSING_COLOR, NEEDS_REVISION_COLOR, ABSENCE_COLOR } from '@/components/ui/StudentStatsWidgets'
import { formatDueDate } from '@/lib/date-utils'
import { readinessTips, type ReadinessBreakdown, type ReadinessItem } from '@/lib/readiness-breakdown'
import type { PreviewWeek } from '@/lib/readiness-score'

type Audience = 'student' | 'staff'

/** Today's date in Eastern time, 'YYYY-MM-DD' -- the same calendar the scoring job uses. */
function todayEt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function itemHref(item: ReadinessItem, audience: Audience): string {
  return audience === 'student'
    ? `/student/courses/${item.courseId}/assignments/${item.assignmentId}`
    : `/instructor/courses/${item.courseId}/assignments/${item.assignmentId}`
}

function PointsPill({ lost }: { lost: number }) {
  return lost > 0 ? (
    <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 whitespace-nowrap">−{lost} {lost === 1 ? 'point' : 'points'}</span>
  ) : (
    <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 whitespace-nowrap">No points lost</span>
  )
}

function Factor({ icon: Icon, color, title, detail, lost, tips, children }: {
  icon: LucideIcon
  color: string
  title: string
  detail: string
  lost: number
  tips: string[]
  children?: React.ReactNode
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}1A` }}>
          <Icon size={14} strokeWidth={2.25} style={{ color }} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-dark-text">{title}</div>
              <div className="text-xs text-muted-text">{detail}</div>
            </div>
            <PointsPill lost={lost} />
          </div>
          {children}
          {tips.map(t => (
            <p key={t} className="text-xs text-dark-text/80 mt-1.5">{t}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

function ItemList({ items, audience, kind }: { items: ReadinessItem[]; audience: Audience; kind: 'missing' | 'returned' }) {
  if (items.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item, i) => (
        <li key={`${item.assignmentId}-${i}`} className="text-sm flex flex-wrap items-baseline gap-x-2">
          <Link href={itemHref(item, audience)} className="text-teal-primary font-medium hover:underline">{item.title}</Link>
          <span className="text-xs text-muted-text">
            {kind === 'missing'
              ? item.dueDate ? `due ${formatDueDate(item.dueDate)}` : null
              : item.returnedAt ? `returned ${new Date(item.returnedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : null}
            {item.priorCourseName ? ` · ${item.priorCourseName}` : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * What's costing points this week, one row per part of the score, with the
 * actual assignments listed and a nudge about the next point. Used on the
 * student's Weekly Readiness page and in the staff Class Readiness live view.
 */
export default function ReadinessBreakdownDetails({ breakdown, week, audience }: {
  breakdown: ReadinessBreakdown
  week: Pick<PreviewWeek, 'end' | 'returnsEnd'>
  audience: Audience
}) {
  const { attendance, missing, needsRevision } = breakdown
  const tips = readinessTips(breakdown, week, todayEt())

  return (
    <div className="divide-y divide-border">
      <Factor
        icon={CalendarX}
        color={ABSENCE_COLOR}
        title="Attendance"
        detail={attendance.blocksTotal > 0
          ? `${attendance.count} of ${attendance.blocksTotal} class blocks missed · every 2 missed costs a point`
          : 'Every 2 class blocks missed costs a point'}
        lost={attendance.pointsLost}
        tips={tips.attendance ? [tips.attendance] : []}
      />
      <Factor
        icon={FileX}
        color={MISSING_COLOR}
        title="Missing assignments"
        detail={`${missing.count} missing right now · every 3 missing costs a point`}
        lost={missing.pointsLost}
        tips={tips.missing}
      >
        <ItemList items={missing.items} audience={audience} kind="missing" />
      </Factor>
      <Factor
        icon={RotateCcw}
        color={NEEDS_REVISION_COLOR}
        title="Returned for revision"
        detail={`${needsRevision.count} ${needsRevision.count === 1 ? 'time' : 'times'} this week (Mon–Sun) · every 2 costs a point`}
        lost={needsRevision.pointsLost}
        tips={tips.needsRevision ? [tips.needsRevision] : []}
      >
        <ItemList items={needsRevision.items} audience={audience} kind="returned" />
      </Factor>
    </div>
  )
}

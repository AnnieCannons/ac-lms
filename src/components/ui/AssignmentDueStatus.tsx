'use client'
import { localDate, todayLocal, formatDueDateWithTime } from '@/lib/date-utils'

// Computed client-side so "past due" reflects the viewer's own local clock/
// timezone rather than the server's — a student a due date can look Late
// a day early (or late) if this ran on the server instead.
export function LateBadge({
  dueDate,
  isExcused,
  hasSubmission,
}: {
  dueDate: string | null
  isExcused: boolean
  hasSubmission: boolean
}) {
  const isPast = !!dueDate && localDate(dueDate) < todayLocal()
  if (isExcused || hasSubmission || !isPast) return null
  return (
    <span className="status-late-badge shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border">
      Late
    </span>
  )
}

export function DueDatePill({
  dueDate,
  isExcused,
  isResolved,
}: {
  dueDate: string
  isExcused: boolean
  isResolved: boolean
}) {
  const isPast = localDate(dueDate) < todayLocal()
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
      isPast && !isResolved && !isExcused
        ? 'bg-amber-500/10 text-amber-700 border-amber-500'
        : 'bg-surface text-muted-text border-border'
    }`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      Due {formatDueDateWithTime(dueDate)}
    </span>
  )
}

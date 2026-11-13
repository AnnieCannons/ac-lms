'use client'
import type { AssignmentStatus } from '@/lib/assignment-status'
import { ExcusedBadge } from './AssignmentDueStatus'

const PILL = 'text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0'

/** Status pills for one assignment, as a student sees it. Compute `status` with getAssignmentStatus. */
export default function AssignmentStatusBadge({ status, isLevelUp }: { status: AssignmentStatus; isLevelUp?: boolean }) {
  if (status.kind === 'excused') return <ExcusedBadge />

  const main =
    status.kind === 'complete' ? <span className={`status-complete-btn ${PILL}`}>Complete ✓</span>
    : status.kind === 'needs-revision' ? <span className={`status-revision-btn ${PILL}`}>Needs Revision</span>
    : status.kind === 'turned-in' ? <span className={`bg-teal-light text-teal-primary border-teal-primary ${PILL}`}>Turned In</span>
    : null

  // Optional: always an Optional pill, plus the status once turned in — never Late or Not Started
  if (status.isOptional) return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className={`bg-teal-light text-teal-primary border-teal-primary/30 ${PILL}`}>Optional</span>
      {main}
    </span>
  )
  if (status.kind === 'complete' || status.kind === 'needs-revision') return main
  // Level Up work that hasn't been turned in gets no badge at all
  if (isLevelUp && status.isOutstanding) return null

  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {status.isLate && <span className={`status-late-badge ${PILL}`}>Late</span>}
      {main ?? (status.kind === 'draft'
        ? <span className={`status-draft-badge ${PILL}`}>Draft</span>
        : <span className={`status-badge bg-surface border-muted-text text-dark-text ${PILL}`}>Not Started</span>)}
    </span>
  )
}

import { localDate, todayLocal } from '@/lib/date-utils'

export type AssignmentStatusKind = 'excused' | 'complete' | 'needs-revision' | 'turned-in' | 'draft' | 'not-started'

export type AssignmentStatusInput = {
  status?: 'draft' | 'submitted' | 'graded' | null
  grade?: 'complete' | 'incomplete' | null
  excused?: boolean
  /** Server-computed is_late from the student's (first) submission, in their own timezone */
  submittedIsLate?: boolean | null
  /** The student's effective due date (their extension, if they have one) */
  dueDate?: string | null
  isOptional?: boolean
  /** false = instructor marks it complete by hand; it can be Not Started but never Late */
  submissionRequired?: boolean
}

export type AssignmentStatus = {
  kind: AssignmentStatusKind
  /** Late = turned in late, or still outstanding past its due date. Never true for excused or optional work. */
  isLate: boolean
  isOptional: boolean
  /** Nothing turned in yet (no submission, or only a draft) and not excused */
  isOutstanding: boolean
}

/**
 * The single source of truth for how an assignment's status looks to a student:
 * the Grades list, the course home outline and the Work list all read it, so the
 * Late / Not Started / Excused rules can't drift apart between them.
 *
 * `today` defaults to the viewer's local date — call this on the client so "past due"
 * follows the student's own clock, not the server's.
 */
export function getAssignmentStatus(input: AssignmentStatusInput, today: Date = todayLocal()): AssignmentStatus {
  const isOptional = !!input.isOptional
  if (input.excused) return { kind: 'excused', isLate: false, isOptional, isOutstanding: false }

  const kind: AssignmentStatusKind =
    input.grade === 'complete' ? 'complete'
    : input.grade === 'incomplete' ? 'needs-revision'
    : input.status === 'submitted' || input.status === 'graded' ? 'turned-in'
    : input.status === 'draft' ? 'draft'
    : 'not-started'
  const isOutstanding = kind === 'draft' || kind === 'not-started'

  // Optional work is never late — skipping it is fine
  const isLate = isOptional ? false
    : !isOutstanding ? !!input.submittedIsLate
    : input.submissionRequired !== false && !!input.dueDate && localDate(input.dueDate) < today

  return { kind, isLate, isOptional, isOutstanding }
}

import { describe, it, expect } from 'vitest'
import { getAssignmentStatus } from '@/lib/assignment-status'

// Fixed "today" so past/future due dates are deterministic
const today = new Date(2026, 9, 9) // Oct 9, 2026
const past = '2026-10-08'
const future = '2026-10-15'

describe('getAssignmentStatus', () => {
  it('excused wins over everything and is never late or outstanding', () => {
    for (const input of [
      { excused: true, dueDate: past },
      { excused: true, status: 'submitted' as const, submittedIsLate: true },
      { excused: true, grade: 'complete' as const },
    ]) {
      expect(getAssignmentStatus(input, today)).toMatchObject({ kind: 'excused', isLate: false, isOutstanding: false })
    }
  })

  it('nothing turned in past the due date is Late + outstanding', () => {
    expect(getAssignmentStatus({ dueDate: past }, today)).toEqual({ kind: 'not-started', isLate: true, isOptional: false, isOutstanding: true })
    expect(getAssignmentStatus({ status: 'draft', dueDate: past }, today)).toMatchObject({ kind: 'draft', isLate: true, isOutstanding: true })
  })

  it('nothing turned in before the due date, or with no due date, is not late', () => {
    expect(getAssignmentStatus({ dueDate: future }, today).isLate).toBe(false)
    expect(getAssignmentStatus({ dueDate: today.toISOString().slice(0, 10) }, today).isLate).toBe(false)
    expect(getAssignmentStatus({}, today).isLate).toBe(false)
  })

  it('an extended due date (passed in as dueDate) is what lateness is measured against', () => {
    expect(getAssignmentStatus({ dueDate: future }, today).isLate).toBe(false)
  })

  it('turned-in work uses the server is_late flag, not the date', () => {
    expect(getAssignmentStatus({ status: 'submitted', dueDate: past, submittedIsLate: false }, today)).toMatchObject({ kind: 'turned-in', isLate: false })
    expect(getAssignmentStatus({ status: 'submitted', dueDate: future, submittedIsLate: true }, today)).toMatchObject({ kind: 'turned-in', isLate: true })
    expect(getAssignmentStatus({ status: 'graded', grade: null }, today).kind).toBe('turned-in')
  })

  it('grades take precedence over submission status', () => {
    expect(getAssignmentStatus({ status: 'graded', grade: 'complete' }, today).kind).toBe('complete')
    expect(getAssignmentStatus({ status: 'submitted', grade: 'incomplete' }, today).kind).toBe('needs-revision')
  })

  it('optional work is never late', () => {
    expect(getAssignmentStatus({ isOptional: true, dueDate: past }, today)).toMatchObject({ isLate: false, isOptional: true, isOutstanding: true })
    expect(getAssignmentStatus({ isOptional: true, status: 'submitted', submittedIsLate: true }, today).isLate).toBe(false)
  })

  it('no-submission-required work can be outstanding but never late', () => {
    expect(getAssignmentStatus({ submissionRequired: false, dueDate: past }, today)).toMatchObject({ kind: 'not-started', isLate: false, isOutstanding: true })
  })
})

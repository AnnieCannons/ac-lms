import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AssignmentStatusBadge from '@/components/ui/AssignmentStatusBadge'
import { getAssignmentStatus, type AssignmentStatusInput } from '@/lib/assignment-status'

const today = new Date(2026, 9, 9)
const renderFor = (input: AssignmentStatusInput, isLevelUp?: boolean) =>
  render(<AssignmentStatusBadge status={getAssignmentStatus(input, today)} isLevelUp={isLevelUp} />)

describe('AssignmentStatusBadge', () => {
  it('excused shows only the Excused pill — no Late, no Not Started', () => {
    renderFor({ excused: true, dueDate: '2026-10-01' })
    expect(screen.getByText('Excused')).toBeInTheDocument()
    expect(screen.queryByText('Late')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Started')).not.toBeInTheDocument()
  })

  it('past due and not started shows Late + Not Started', () => {
    renderFor({ dueDate: '2026-10-01' })
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Not Started')).toBeInTheDocument()
  })

  it('a draft shows Draft rather than Not Started', () => {
    renderFor({ status: 'draft', dueDate: '2026-10-20' })
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('turned in late shows Late + Turned In', () => {
    renderFor({ status: 'submitted', submittedIsLate: true })
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Turned In')).toBeInTheDocument()
  })

  it('graded shows just the grade', () => {
    renderFor({ status: 'graded', grade: 'complete', submittedIsLate: true })
    expect(screen.getByText('Complete ✓')).toBeInTheDocument()
    expect(screen.queryByText('Late')).not.toBeInTheDocument()
  })

  it('optional shows Optional, never Late or Not Started', () => {
    renderFor({ isOptional: true, dueDate: '2026-10-01' })
    expect(screen.getByText('Optional')).toBeInTheDocument()
    expect(screen.queryByText('Late')).not.toBeInTheDocument()
    expect(screen.queryByText('Not Started')).not.toBeInTheDocument()
  })

  it('Level Up work that has not been turned in shows nothing', () => {
    const { container } = renderFor({ dueDate: '2026-10-01' }, true)
    expect(container).toBeEmptyDOMElement()
  })
})

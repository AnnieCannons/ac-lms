import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/grade-actions', () => ({ markCompleteNoSubmission: vi.fn() }))

import GradebookCell from '@/components/ui/GradebookCell'

const base = { courseId: 'c1', assignmentId: 'a1', studentId: 's1' }
const renderCell = (props: Partial<React.ComponentProps<typeof GradebookCell>>) =>
  render(<table><tbody><tr><GradebookCell {...base} submission={null} dueDate={null} {...props} /></tr></tbody></table>)

describe('GradebookCell excused', () => {
  it('shows an EX marker for an excused student with nothing submitted', () => {
    // The grid passes a null due date for excused students
    renderCell({ excused: true })
    const cell = screen.getByLabelText('Excused')
    expect(cell).toHaveTextContent('EX')
  })

  it('a past-due unexcused cell still shows as missing', () => {
    renderCell({ dueDate: '2026-01-01' })
    expect(screen.getByLabelText('Missing / past due')).toHaveTextContent('–')
  })

  it('a real submission wins over excused', () => {
    renderCell({ excused: true, submission: { status: 'graded', grade: 'complete' } })
    expect(screen.getByLabelText('Complete')).toHaveTextContent('✓')
    expect(screen.queryByLabelText('Excused')).not.toBeInTheDocument()
  })
})

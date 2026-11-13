import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/override-actions', () => ({ bulkUpsertAssignmentOverrides: vi.fn() }))

import BulkOverridePaste from '@/components/ui/BulkOverridePaste'
import { bulkUpsertAssignmentOverrides } from '@/lib/override-actions'

const students = [
  { id: 's1', name: 'Jane Smith' },
  { id: 's2', name: 'Sam Lee' },
  { id: 's3', name: 'Sam Patel' },
]

function setup(existing: string[] = []) {
  const onSaved = vi.fn()
  render(
    <BulkOverridePaste
      assignmentId="a1"
      courseId="c1"
      students={students}
      existingStudentIds={new Set(existing)}
      onSaved={onSaved}
      onCancel={vi.fn()}
    />
  )
  return { onSaved, user: userEvent.setup() }
}

beforeEach(() => vi.clearAllMocks())

describe('BulkOverridePaste', () => {
  it('previews matches, ambiguous and unknown names before saving', async () => {
    const { user } = setup(['s1'])
    await user.type(screen.getByLabelText('Paste student names'), 'jane smith{enter}Sam{enter}Bob')
    expect(screen.getByText(/Matched 1 student/)).toBeInTheDocument()
    expect(screen.getByText(/replaces override/)).toBeInTheDocument()
    expect(screen.getByText(/could be Sam Lee, Sam Patel/)).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(bulkUpsertAssignmentOverrides).not.toHaveBeenCalled()
  })

  it('excuses only the matched students', async () => {
    vi.mocked(bulkUpsertAssignmentOverrides).mockResolvedValue({ overrides: [{ id: 'o1', student_id: 's1' }, { id: 'o2', student_id: 's2' }] })
    const { user, onSaved } = setup()
    await user.type(screen.getByLabelText('Paste student names'), 'Jane Smith, Sam Lee, Nobody')
    await user.click(screen.getByRole('button', { name: /Excuse 2 students/ }))
    expect(bulkUpsertAssignmentOverrides).toHaveBeenCalledWith('a1', ['s1', 's2'], 'c1', null, true)
    expect(onSaved).toHaveBeenCalledWith([
      { id: 'o1', student_id: 's1', student_name: 'Jane Smith', due_date: null, excused: true },
      { id: 'o2', student_id: 's2', student_name: 'Sam Lee', due_date: null, excused: true },
    ])
  })

  it('needs a date before it can set a due date', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Paste student names'), 'Jane Smith')
    expect(screen.getByRole('button', { name: 'Set due date' })).toBeDisabled()
  })
})

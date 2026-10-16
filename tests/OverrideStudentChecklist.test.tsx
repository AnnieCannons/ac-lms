import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/override-actions', () => ({ bulkUpsertAssignmentOverrides: vi.fn() }))

import OverrideStudentChecklist from '@/components/ui/OverrideStudentChecklist'
import { bulkUpsertAssignmentOverrides } from '@/lib/override-actions'

const students = [
  { id: 's1', name: 'Jane Smith' },
  { id: 's2', name: 'Sam Lee' },
  { id: 's3', name: 'Aisha Khan' },
]

function setup(list = students) {
  const onSaved = vi.fn()
  render(<OverrideStudentChecklist assignmentId="a1" courseId="c1" students={list} onSaved={onSaved} onCancel={vi.fn()} />)
  return { onSaved, user: userEvent.setup() }
}

beforeEach(() => vi.clearAllMocks())

describe('OverrideStudentChecklist', () => {
  it('excuses every ticked student in one call', async () => {
    vi.mocked(bulkUpsertAssignmentOverrides).mockResolvedValue({
      overrides: [{ id: 'o1', student_id: 's1' }, { id: 'o3', student_id: 's3' }],
    })
    const { user, onSaved } = setup()
    expect(screen.getByRole('button', { name: '+ Excuse' })).toBeDisabled()
    await user.click(screen.getByLabelText('Jane Smith'))
    await user.click(screen.getByLabelText('Aisha Khan'))
    await user.click(screen.getByRole('button', { name: '+ Excuse 2 students' }))
    expect(bulkUpsertAssignmentOverrides).toHaveBeenCalledWith('a1', ['s1', 's3'], 'c1', null, true)
    expect(onSaved).toHaveBeenCalledWith([
      { id: 'o1', student_id: 's1', student_name: 'Jane Smith', due_date: null, excused: true },
      { id: 'o3', student_id: 's3', student_name: 'Aisha Khan', due_date: null, excused: true },
    ])
  })

  it('sets a due date for the ticked students, and Select all toggles everyone', async () => {
    vi.mocked(bulkUpsertAssignmentOverrides).mockResolvedValue({ overrides: [] })
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByRole('button', { name: '+ Excuse 3 students' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Set due date' })).toBeDisabled()
    await user.type(screen.getByLabelText('Custom due date for selected students'), '2026-10-20')
    await user.click(screen.getByRole('button', { name: 'Set due date' }))
    expect(vi.mocked(bulkUpsertAssignmentOverrides).mock.calls[0][1]).toHaveLength(3)
    expect(vi.mocked(bulkUpsertAssignmentOverrides).mock.calls[0][3]).toBe('2026-10-20')
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByRole('button', { name: '+ Excuse' })).toBeDisabled()
  })

  it('shows the server error and keeps the panel open', async () => {
    vi.mocked(bulkUpsertAssignmentOverrides).mockResolvedValue({ error: 'Not authorized' })
    const { user, onSaved } = setup()
    await user.click(screen.getByLabelText('Sam Lee'))
    await user.click(screen.getByRole('button', { name: '+ Excuse 1 student' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Not authorized')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('filters a long roster by name without losing ticks', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `Student ${i}` }))
    const { user } = setup([...many, { id: 's1', name: 'Jane Smith' }])
    await user.click(screen.getByLabelText('Student 3'))
    await user.type(screen.getByLabelText('Filter students'), 'jane')
    expect(screen.queryByLabelText('Student 3')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Jane Smith'))
    expect(screen.getByRole('button', { name: '+ Excuse 2 students' })).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/assignment-series-actions', () => ({ setGoalClaim: vi.fn() }))

import GoalCheckoff from '@/components/ui/GoalCheckoff'
import { setGoalClaim } from '@/lib/assignment-series-actions'

const base = {
  assignmentId: 'a1', courseId: 'c1', label: 'I met my typing goal', initialClaimed: false, confirmed: false, excusedCount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(setGoalClaim).mockResolvedValue({})
})

describe('GoalCheckoff', () => {
  it('checking it saves the claim, drops confetti and tells the student the instructor will see it', async () => {
    render(<GoalCheckoff {...base} />)
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'I met my typing goal' }))
    expect(setGoalClaim).toHaveBeenCalledWith({ assignmentId: 'a1', courseId: 'c1', claimed: true })
    expect(screen.getByTestId('confetti')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/instructor will see this when they grade/)
  })

  it('unchecking removes the claim without confetti', async () => {
    render(<GoalCheckoff {...base} initialClaimed />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(setGoalClaim).toHaveBeenCalledWith({ assignmentId: 'a1', courseId: 'c1', claimed: false })
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument()
  })

  it('puts the box back and shows the error when saving fails', async () => {
    vi.mocked(setGoalClaim).mockResolvedValue({ error: 'Only students can check this' })
    render(<GoalCheckoff {...base} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent('Only students can check this')
  })

  it('once confirmed, is locked and says how many weeks were excused', () => {
    render(<GoalCheckoff {...base} initialClaimed confirmed excusedCount={6} />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent("You're excused from the remaining 6 weeks")
  })

  it('is read-only in preview', () => {
    render(<GoalCheckoff {...base} disabled />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})

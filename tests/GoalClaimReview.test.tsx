import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/assignment-series-actions', () => ({ confirmGoalClaim: vi.fn() }))

import GoalClaimReview from '@/components/ui/GoalClaimReview'
import { confirmGoalClaim } from '@/lib/assignment-series-actions'

const base = {
  assignmentId: 'a1', courseId: 'c1', studentId: 's1', studentName: 'Ada Lovelace', label: 'I met my typing goal',
  claimedAt: '2026-11-05T18:00:00.000Z', confirmedAt: null, excusedCount: 0, repeats: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(confirmGoalClaim).mockResolvedValue({ excused: 5 })
})

describe('GoalClaimReview', () => {
  it('flags the claim and confirms it, excusing later weeks', async () => {
    render(<GoalClaimReview {...base} />)
    expect(screen.getByText('Ada says they met their goal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm & excuse later weeks' }))
    expect(confirmGoalClaim).toHaveBeenCalledWith({ assignmentId: 'a1', courseId: 'c1', studentId: 's1', confirmed: true })
    expect(refresh).toHaveBeenCalled()
  })

  it('a one-time assignment just confirms the goal', () => {
    render(<GoalClaimReview {...base} repeats={false} />)
    expect(screen.getByRole('button', { name: 'Confirm goal met' })).toBeInTheDocument()
  })

  it('a confirmed claim offers undo, after asking first', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<GoalClaimReview {...base} confirmedAt="2026-11-06T18:00:00.000Z" excusedCount={5} />)
    expect(screen.getByText(/excused from 5 later weeks/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo confirmation' }))
    expect(confirmGoalClaim).toHaveBeenCalledWith({ assignmentId: 'a1', courseId: 'c1', studentId: 's1', confirmed: false })
  })
})

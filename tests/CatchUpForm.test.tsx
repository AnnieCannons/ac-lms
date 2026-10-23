import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/class-catch-up-actions', () => ({ submitCatchUpForm: vi.fn() }))

import CatchUpForm from '@/components/catch-up/CatchUpForm'
import { submitCatchUpForm } from '@/lib/class-catch-up-actions'

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => vi.clearAllMocks())

describe('CatchUpForm', () => {
  it('pre-fills the missed blocks from the Slack link', () => {
    render(<CatchUpForm courseId="c1" absenceDate="2026-10-21" initialMissedBlocks="Block A on Wednesday, October 21" />)
    expect(screen.getByLabelText(/which blocks did you miss/i)).toHaveValue('Block A on Wednesday, October 21')
  })

  it('says which required answer is missing without sending', async () => {
    render(<CatchUpForm courseId="c1" absenceDate={null} initialMissedBlocks="Block A" />)
    fireEvent.click(screen.getByRole('button', { name: /send my catch-up form/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/which lectures\/subjects did you miss/i)
    expect(submitCatchUpForm).not.toHaveBeenCalled()
  })

  it('sends the answers and thanks the student', async () => {
    vi.mocked(submitCatchUpForm).mockResolvedValue({ ok: true, instructorsNotified: 1 })
    render(<CatchUpForm courseId="c1" absenceDate="2026-10-21" initialMissedBlocks="Block A" />)
    fill(/which lectures/i, 'Async JS')
    fill(/paste the links/i, 'https://x/rec')
    fill(/which assignments/i, 'Lab')
    fill(/plan to make up/i, 'Friday')
    fireEvent.click(screen.getByRole('button', { name: /send my catch-up form/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/your catch-up form is sent/i))
    expect(submitCatchUpForm).toHaveBeenCalledWith('c1', expect.objectContaining({ lecturesMissed: 'Async JS', makeupPlan: 'Friday' }), '2026-10-21')
  })

  it('cannot be sent in preview', () => {
    render(<CatchUpForm courseId="c1" absenceDate={null} initialMissedBlocks="" disabled />)
    expect(screen.getByRole('button', { name: /send my catch-up form/i })).toBeDisabled()
  })
})

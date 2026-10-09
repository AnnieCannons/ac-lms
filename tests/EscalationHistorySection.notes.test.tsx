import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('recharts', () => ({}))

import { EscalationHistorySection } from '@/components/ui/ReadinessWidgets'
import type { EscalationEventRecord } from '@/lib/readiness-actions'
import type { ReadinessNote } from '@/lib/readiness-notes-actions'

const event = (id: string, eventType: string, createdAt: string): EscalationEventRecord =>
  ({ id, weekStart: null, eventType, score: null, note: null, createdAt })

const note = (id: string, noteDate: string, body: string): ReadinessNote => ({
  id, noteDate, body, visibleToStudent: false, authorName: 'Catie',
  createdAt: '2026-10-09T18:00:00.000Z', updatedAt: '2026-10-09T18:00:00.000Z', canEdit: false, canDelete: false,
})

describe('EscalationHistorySection with notes', () => {
  it('starts open and places notes by date inside and outside escalation cycles', () => {
    const { container } = render(
      <EscalationHistorySection
        events={[event('e1', 'step1_started', '2026-09-01T17:00:00.000Z'), event('e2', 'reset', '2026-09-15T17:00:00.000Z')]}
        notes={[note('n1', '2026-09-08', 'During the cycle'), note('n2', '2026-10-01', 'After the cycle'), note('n3', '2026-08-20', 'Before the cycle')]}
      />,
    )

    expect(screen.getByRole('button', { name: /hide history/i })).toBeTruthy()

    const cards = container.querySelectorAll('.rounded-xl')
    expect(cards).toHaveLength(3)
    expect(within(cards[0] as HTMLElement).getByText('After the cycle')).toBeTruthy()
    expect(within(cards[1] as HTMLElement).getByText('During the cycle')).toBeTruthy()
    expect(within(cards[2] as HTMLElement).getByText('Before the cycle')).toBeTruthy()

    // Inside the cycle card: reset (Sep 15), then the note (Sep 8), then step 1 (Sep 1).
    const rows = (cards[1] as HTMLElement).querySelectorAll('li')
    expect(rows).toHaveLength(3)
    expect(rows[1].textContent).toContain('During the cycle')
  })

  it('shows history for notes alone, with no escalation events', () => {
    render(<EscalationHistorySection events={[]} notes={[note('n1', '2026-10-01', 'Just a note')]} />)
    expect(screen.getByText('Just a note')).toBeTruthy()
  })
})

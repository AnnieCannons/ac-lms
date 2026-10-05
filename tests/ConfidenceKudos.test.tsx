import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfidenceKudos from '@/components/ui/ConfidenceKudos'

describe('ConfidenceKudos', () => {
  it('shows only the plain "went up from X to Y" line, with no maintaining variant, even for a skill that went up to 10', () => {
    render(
      <ConfidenceKudos
        items={[
          { skillName: 'Git', from: 6, to: 10 },
          { skillName: 'React', from: 4, to: 6 },
        ]}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText(/Nice progress!/)).toBeInTheDocument()
    expect(screen.getByText('Your confidence in Git went up from 6 to 10.')).toBeInTheDocument()
    expect(screen.getByText('Your confidence in React went up from 4 to 6.')).toBeInTheDocument()
    expect(screen.queryByText(/maintaining/)).not.toBeInTheDocument()
  })

  it('renders nothing when there are no items', () => {
    const { container } = render(<ConfidenceKudos items={[]} onDismiss={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the change for each improved skill in a polite status region', () => {
    render(
      <ConfidenceKudos
        items={[
          { skillName: 'React', from: 4, to: 6 },
          { skillName: 'Git', from: 1, to: 2 },
        ]}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/confidence in React went up from 4 to 6/)).toBeInTheDocument()
    expect(screen.getByText(/confidence in Git went up from 1 to 2/)).toBeInTheDocument()
  })

  it('asks nothing: only a dismiss button, no inputs', async () => {
    const onDismiss = vi.fn()
    render(<ConfidenceKudos items={[{ skillName: 'React', from: 4, to: 6 }]} onDismiss={onDismiss} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

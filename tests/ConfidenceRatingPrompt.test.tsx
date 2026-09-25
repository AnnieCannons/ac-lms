import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfidenceRatingPrompt from '@/components/ui/ConfidenceRatingPrompt'
import type { ConfidenceSkill } from '@/lib/skill-actions'

const SKILLS: ConfidenceSkill[] = [
  { id: 'skill-a', name: 'React' },
  { id: 'skill-b', name: 'Testing' },
]

describe('ConfidenceRatingPrompt', () => {
  it('renders nothing when there are no tagged skills', () => {
    const { container } = render(
      <ConfidenceRatingPrompt skills={[]} value={{}} onChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a labeled 1–10 control for each tagged skill', () => {
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={vi.fn()} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    const testingGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Testing' })
    expect(within(reactGroup).getAllByRole('radio')).toHaveLength(10)
    expect(within(testingGroup).getAllByRole('radio')).toHaveLength(10)
  })

  it('calls onChange with the skill id and chosen rating when a value is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={onChange} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '8' }))
    expect(onChange).toHaveBeenCalledWith('skill-a', 8)
  })

  it('clicking an already-selected rating calls onChange with null to unselect it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{ 'skill-a': 8 }} onChange={onChange} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '8' }))
    expect(onChange).toHaveBeenCalledWith('skill-a', null)
  })

  it('gives each rating an explanatory hover tooltip from the confidence scale', () => {
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={vi.fn()} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    expect(within(reactGroup).getByText(/just learned this exists/)).toBeInTheDocument()
    expect(within(reactGroup).getByText(/teach this to someone just starting out/)).toBeInTheDocument()
  })

  it('reflects the selected rating from the controlled value prop', () => {
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{ 'skill-a': 4 }} onChange={vi.fn()} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    expect(within(reactGroup).getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true')
    expect(within(reactGroup).getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'false')
  })

  it('disables all rating controls when disabled is true', () => {
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={vi.fn()} disabled />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    within(reactGroup).getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled())
  })
})

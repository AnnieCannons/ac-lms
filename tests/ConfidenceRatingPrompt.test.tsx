import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, addDays } from 'date-fns'
import ConfidenceRatingPrompt from '@/components/ui/ConfidenceRatingPrompt'
import type { ConfidenceSkillWithStatus } from '@/lib/confidence-tracker-actions'
import type { GoalState } from '@/lib/confidence-tracker-validation'

const SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false },
  { id: 'skill-b', name: 'Testing', isNew: false },
]

const NEW_SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: true },
  { id: 'skill-b', name: 'Testing', isNew: false },
]

describe('ConfidenceRatingPrompt', () => {
  it('renders nothing when there are no tagged skills', () => {
    const { container } = render(
      <ConfidenceRatingPrompt skills={[]} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a labeled 1–10 control for each tagged skill', () => {
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    const testingGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Testing' })
    expect(within(reactGroup).getAllByRole('radio')).toHaveLength(10)
    expect(within(testingGroup).getAllByRole('radio')).toHaveLength(10)
  })

  it('calls onChange with the skill id and chosen rating when a value is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={onChange} goals={{}} onGoalChange={vi.fn()} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '8' }))
    expect(onChange).toHaveBeenCalledWith('skill-a', 8)
  })

  it('clicking an already-selected rating calls onChange with null to unselect it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <ConfidenceRatingPrompt
        skills={SKILLS}
        value={{ 'skill-a': 8 }}
        onChange={onChange}
        goals={{}}
        onGoalChange={vi.fn()}
      />
    )
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    await user.click(within(reactGroup).getByRole('radio', { name: '8' }))
    expect(onChange).toHaveBeenCalledWith('skill-a', null)
  })

  it('gives each rating an explanatory hover tooltip from the confidence scale', () => {
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    expect(within(reactGroup).getByText(/just learned this exists/)).toBeInTheDocument()
    expect(within(reactGroup).getByText(/teach this to someone just starting out/)).toBeInTheDocument()
  })

  it('reflects the selected rating from the controlled value prop', () => {
    render(
      <ConfidenceRatingPrompt
        skills={SKILLS}
        value={{ 'skill-a': 4 }}
        onChange={vi.fn()}
        goals={{}}
        onGoalChange={vi.fn()}
      />
    )
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    expect(within(reactGroup).getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true')
    expect(within(reactGroup).getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'false')
  })

  it('disables all rating controls when disabled is true', () => {
    render(
      <ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} disabled />
    )
    const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
    within(reactGroup).getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled())
  })

  describe('new-skill goal capture', () => {
    it('shows a "New" tag only for skills the student has never rated before, regardless of rating state', () => {
      render(
        <ConfidenceRatingPrompt skills={NEW_SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />
      )
      expect(screen.getByText('React')).toHaveTextContent('New')
      expect(screen.getByText('Testing')).not.toHaveTextContent('New')
    })

    it('does not show the goal section for a new skill until it has been rated', () => {
      render(
        <ConfidenceRatingPrompt skills={NEW_SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />
      )
      expect(screen.queryByText(/Set a goal for this skill/)).not.toBeInTheDocument()
    })

    it('auto-suggests goal, target date, and a blank study plan when a new skill is first rated', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt skills={NEW_SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={onGoalChange} />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', {
        goal: 7,
        targetDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        studyPlan: '',
        studyPlanOther: '',
      })
    })

    it('caps the auto-suggested goal at 10 for a rating of 9', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt skills={NEW_SKILLS} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={onGoalChange} />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '9' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', expect.objectContaining({ goal: 10 }))
    })

    it('shows "maintaining this rating" messaging instead of a numeric goal when the rating is 10', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      const goals: Record<string, GoalState> = {}
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{}}
          onChange={vi.fn()}
          goals={goals}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', expect.objectContaining({ goal: 'maintain' }))
    })

    it('renders "maintaining" copy and no numeric goal radiogroup when goal state is "maintain"', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 10 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 'maintain', targetDate: '2026-10-05', studyPlan: '', studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.getByText(/maintaining this rating/)).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Goal for React' })).not.toBeInTheDocument()
    })

    it('only offers goal values from rating+1 through 10', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 7 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 9, targetDate: '2026-10-05', studyPlan: '', studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      const goalGroup = screen.getByRole('radiogroup', { name: 'Goal for React' })
      expect(within(goalGroup).getAllByRole('radio')).toHaveLength(3) // 8, 9, 10
    })

    it('clicking the rating again to clear it also clears the goal', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: 'flashcards', studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
    })

    it('clicking "Clear goal" clears the goal without affecting the rating', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={onChange}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: 'flashcards', studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Clear goal' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('hides target date and study plan once the goal is cleared', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: null, targetDate: '', studyPlan: '', studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.queryByText('Target date')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/How do you plan to work on this/)).not.toBeInTheDocument()
    })

    it('selecting "Other" for study plan reveals a free-text field; switching away hides it', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      const { rerender } = render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: '', studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      expect(screen.queryByPlaceholderText('Describe your plan…')).not.toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText(/How do you plan to work on this/), 'other')
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { studyPlan: 'other', studyPlanOther: '' })

      rerender(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: 'other', studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      expect(screen.getByPlaceholderText('Describe your plan…')).toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText(/How do you plan to work on this/), 'flashcards')
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { studyPlan: 'flashcards', studyPlanOther: '' })
    })

    it('disables the goal, target date, and study plan controls when disabled is true', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: 'flashcards', studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
          disabled
        />
      )
      const goalGroup = screen.getByRole('radiogroup', { name: 'Goal for React' })
      within(goalGroup).getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled())
      expect(screen.getByRole('button', { name: 'Clear goal' })).toBeDisabled()
      expect(screen.getByLabelText(/How do you plan to work on this/)).toBeDisabled()
    })
  })
})

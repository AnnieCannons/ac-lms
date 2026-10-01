import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, addDays } from 'date-fns'
import ConfidenceRatingPrompt from '@/components/ui/ConfidenceRatingPrompt'
import type { ConfidenceSkillWithStatus } from '@/lib/confidence-tracker-actions'
import type { GoalState } from '@/lib/confidence-tracker-validation'

const SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false, canSetGoal: false },
  { id: 'skill-b', name: 'Testing', isNew: false, canSetGoal: false },
]

const NEW_SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: true, canSetGoal: true },
  { id: 'skill-b', name: 'Testing', isNew: false, canSetGoal: false },
]

// A skill the student has rated before (no "New" tag) but skipped goal-setting on that
// occasion — goal-setting must still be offered, independent of the "New" tag.
const SKIPPED_GOAL_SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false, canSetGoal: true },
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

    it('offers goal-setting for a skill the student has rated before, as long as no goal was ever set (goal-setting is independent of the "New" tag)', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={SKIPPED_GOAL_SKILLS}
          value={{}}
          onChange={vi.fn()}
          goals={{}}
          onGoalChange={onGoalChange}
        />
      )
      expect(screen.getByText('React')).not.toHaveTextContent('New')
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      // value/onChange are plain mocks here (not wired back into React state), so the
      // rating itself won't visibly re-render as selected — the goal auto-suggestion
      // firing at all is the proof that goal-setting was offered for this occasion.
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', expect.objectContaining({ goal: 7 }))
    })

    it('does not offer goal-setting again once a goal has already been captured for a skill', () => {
      render(
        <ConfidenceRatingPrompt
          skills={[{ id: 'skill-a', name: 'React', isNew: false, canSetGoal: false }]}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{}}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.queryByText(/Set a goal for this skill/)).not.toBeInTheDocument()
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
        studyPlan: [],
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

    it('switches to the "maintain" goal state instead of a numeric goal when the rating is 10', async () => {
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
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', {
        goal: 'maintain',
        targetDate: '',
        studyPlan: [],
        studyPlanOther: '',
      })
    })

    it('re-suggests the goal to match a new rating when the rating is changed while a goal is already set', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      // The old goal of 7 is still numerically valid for a rating of 6 (7 >= 6 + 1), so
      // this specifically exercises the reported bug: the goal must still re-suggest to
      // track the new rating, not just get reclamped when it becomes invalid.
      await user.click(within(reactGroup).getByRole('radio', { name: '6' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { goal: 8, targetDate: '2026-10-05' })
    })

    it('switches an in-progress goal to "maintain" if the rating is changed up to 10', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { goal: 'maintain' })
    })

    it('restores a target date when the rating is changed down from 10 (maintaining) to a numeric goal', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 10 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 'maintain', targetDate: '', studyPlan: [], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '7' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', {
        goal: 9,
        targetDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      })
    })

    it('preserves an already-set target date when switching between two numeric ratings', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '6' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { goal: 8, targetDate: '2026-10-05' })
    })

    it('shows no "maintaining" message while rating (it appears after submission) and no numeric goal radiogroup when goal state is "maintain"', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 10 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 'maintain', targetDate: '2026-10-05', studyPlan: [], studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.queryByText(/maintaining this rating/)).not.toBeInTheDocument()
      expect(screen.queryByText(/top of the scale/)).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Goal for React' })).not.toBeInTheDocument()
    })

    it('renders no target date, study plan, "Set a goal" prompt, or "Skip" control while maintaining — it is purely informational', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 10 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 'maintain', targetDate: '', studyPlan: [], studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.queryByText('Target date')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/How do you plan to work on this/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Set a goal for this skill/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    })

    it('only offers goal values from rating+1 through 10', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 7 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 9, targetDate: '2026-10-05', studyPlan: [], studyPlanOther: '' } }}
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
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '5' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
    })

    it('clicking "Skip" clears the goal without affecting the rating', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={onChange}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Skip' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('restores a target date when picking a new goal value after "Skip" wiped the state', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{}}
          onGoalChange={onGoalChange}
        />
      )
      const goalGroup = screen.getByRole('radiogroup', { name: 'Goal for React' })
      await user.click(within(goalGroup).getByRole('radio', { name: 'Goal 8' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', {
        goal: 8,
        targetDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      })
    })

    it('preserves an already-set target date when picking a different goal value directly', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const goalGroup = screen.getByRole('radiogroup', { name: 'Goal for React' })
      await user.click(within(goalGroup).getByRole('radio', { name: 'Goal 9' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { goal: 9, targetDate: '2026-10-05' })
    })

    it('hides target date and study plan once the goal is cleared', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: null, targetDate: '', studyPlan: [], studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.queryByText('Target date')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/How do you plan to work on this/)).not.toBeInTheDocument()
    })

    it('study plan is a multi-select — more than one option can be chosen at once', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Get help from an Instructor or a TA' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', {
        studyPlan: ['flashcards', 'ta_help'],
        studyPlanOther: '',
      })
    })

    it('clicking an already-selected study plan option toggles it off', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards', 'ta_help'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Study flashcards' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { studyPlan: ['ta_help'], studyPlanOther: '' })
    })

    it('selecting "Other" for study plan reveals a free-text field; deselecting it hides it', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      const { rerender } = render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: [], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      expect(screen.queryByPlaceholderText('Describe your plan…')).not.toBeInTheDocument()

      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      await user.click(within(planGroup).getByRole('checkbox', { name: 'Other' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { studyPlan: ['other'], studyPlanOther: '' })

      rerender(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['other'], studyPlanOther: '' } }}
          onGoalChange={onGoalChange}
        />
      )
      expect(screen.getByPlaceholderText('Describe your plan…')).toBeInTheDocument()

      await user.click(within(planGroup).getByRole('checkbox', { name: 'Other' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', { studyPlan: [], studyPlanOther: '' })
    })

    it('disables the goal, target date, and study plan controls when disabled is true', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 5 }}
          onChange={vi.fn()}
          goals={{ 'skill-a': { goal: 7, targetDate: '2026-10-05', studyPlan: ['flashcards'], studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
          disabled
        />
      )
      const goalGroup = screen.getByRole('radiogroup', { name: 'Goal for React' })
      within(goalGroup).getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled())
      expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled()
      const planGroup = screen.getByRole('group', { name: /How do you plan to work on this/ })
      within(planGroup).getAllByRole('checkbox').forEach(btn => expect(btn).toBeDisabled())
    })
  })
})

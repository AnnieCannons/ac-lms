import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, addDays } from 'date-fns'
import ConfidenceRatingPrompt from '@/components/ui/ConfidenceRatingPrompt'
import type { ConfidenceSkillWithStatus } from '@/lib/confidence-tracker-actions'
import type { GoalState } from '@/lib/confidence-tracker-validation'

const SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false, canSetGoal: false, isMaintaining: false },
  { id: 'skill-b', name: 'Testing', isNew: false, canSetGoal: false, isMaintaining: false },
]

const NEW_SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: true, canSetGoal: true, isMaintaining: false },
  { id: 'skill-b', name: 'Testing', isNew: false, canSetGoal: false, isMaintaining: false },
]

// A skill the student has rated before (no "New" tag) but skipped goal-setting on that
// occasion — goal-setting must still be offered, independent of the "New" tag.
const SKIPPED_GOAL_SKILLS: ConfidenceSkillWithStatus[] = [
  { id: 'skill-a', name: 'React', isNew: false, canSetGoal: true, isMaintaining: false },
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
          skills={[{ id: 'skill-a', name: 'React', isNew: false, canSetGoal: false, isMaintaining: false }]}
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

    it('rating a new skill 10 clears any goal instead of suggesting one, and shows no goal fields', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt skills={NEW_SKILLS} value={{}} onChange={onChange} goals={{}} onGoalChange={onGoalChange} />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      expect(onChange).toHaveBeenCalledWith('skill-a', 10)
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
      expect(onGoalChange).not.toHaveBeenCalledWith('skill-a', expect.objectContaining({ goal: 'maintain' }))
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

    it('clears an in-progress goal if the rating is changed up to 10', async () => {
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
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
    })

    it('suggests a fresh goal with a target date when the rating is changed down from 10', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 10 }}
          onChange={vi.fn()}
          goals={{}}
          onGoalChange={onGoalChange}
        />
      )
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '7' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', {
        goal: 9,
        targetDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        studyPlan: [],
        studyPlanOther: '',
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

    it('shows no goal fields at all for a rating of 10', () => {
      render(
        <ConfidenceRatingPrompt
          skills={NEW_SKILLS}
          value={{ 'skill-a': 10 }}
          onChange={vi.fn()}
          goals={{}}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.queryByRole('radiogroup', { name: 'Goal for React' })).not.toBeInTheDocument()
      expect(screen.queryByText('Target date')).not.toBeInTheDocument()
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

  describe('maintained skills (latest rating 10)', () => {
    const MAINTAINED: ConfidenceSkillWithStatus[] = [
      { id: 'skill-g', name: 'Git', isNew: false, canSetGoal: true, isMaintaining: true },
      { id: 'skill-h', name: 'HTML', isNew: false, canSetGoal: false, isMaintaining: true },
      { id: 'skill-a', name: 'React', isNew: false, canSetGoal: true, isMaintaining: false },
    ]
    const disclosure = () => screen.getByRole('button', { name: /Still feeling confident on/ })
    const NO_GOAL = { goal: null, targetDate: '', studyPlan: [], studyPlanOther: '' }

    it('groups maintained skills into one collapsed row and keeps Growing skills as normal boxes', () => {
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
      expect(disclosure()).toHaveTextContent('Still feeling confident on your maintaining skills?')
      expect(disclosure()).toHaveAttribute('aria-expanded', 'false')
      expect(disclosure()).toHaveTextContent('Change a rating')
      expect(screen.getByRole('radiogroup', { name: 'Confidence rating for React' })).toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Confidence rating for Git' })).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Confidence rating for HTML' })).not.toBeInTheDocument()
    })

    it('keeps the maintaining line visible while the row is collapsed', () => {
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
      expect(disclosure()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByText(/You're maintaining these skills at 10/)).toBeVisible()
    })

    it('expands on click, and collapses again on a second click', async () => {
      const user = userEvent.setup()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
      await user.click(disclosure())
      expect(disclosure()).toHaveAttribute('aria-expanded', 'true')
      expect(disclosure()).not.toHaveTextContent('Change a rating')
      expect(screen.getByRole('radiogroup', { name: 'Confidence rating for Git' })).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: 'Confidence rating for HTML' })).toBeInTheDocument()
      await user.click(disclosure())
      expect(screen.queryByRole('radiogroup', { name: 'Confidence rating for Git' })).not.toBeInTheDocument()
    })

    it('shows 10 as the current rating, not as a selected rating, and no rating is in value', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={onChange} goals={{}} onGoalChange={vi.fn()} />)
      await user.click(disclosure())
      const gitGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Git' })
      const current = within(gitGroup).getByRole('radio', { name: '10, current rating' })
      expect(current).toHaveAttribute('aria-checked', 'true')
      expect(within(gitGroup).getByRole('radio', { name: '9' })).toHaveAttribute('aria-checked', 'false')
      // Said once for the whole row, not once per skill.
      expect(screen.getAllByText(/You're maintaining these skills at 10/)).toHaveLength(1)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('picking a lower number calls onChange and suggests a goal for a skill that can set one', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const onGoalChange = vi.fn()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={onChange} goals={{}} onGoalChange={onGoalChange} />)
      await user.click(disclosure())
      const gitGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '7' }))
      expect(onChange).toHaveBeenCalledWith('skill-g', 7)
      expect(onGoalChange).toHaveBeenCalledWith('skill-g', expect.objectContaining({ goal: 9 }))
      expect(onGoalChange).not.toHaveBeenCalledWith('skill-g', expect.objectContaining({ goal: 'maintain' }))
    })

    it('picking a lower number for a maintained skill that cannot set a goal sets no goal', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const onGoalChange = vi.fn()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={onChange} goals={{}} onGoalChange={onGoalChange} />)
      await user.click(disclosure())
      const htmlGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for HTML' })
      await user.click(within(htmlGroup).getByRole('radio', { name: '6' }))
      expect(onChange).toHaveBeenCalledWith('skill-h', 6)
      expect(onGoalChange).not.toHaveBeenCalled()
    })

    it('shows goal fields right in the box once a lower rating is in value', () => {
      render(
        <ConfidenceRatingPrompt
          skills={MAINTAINED}
          value={{ 'skill-g': 7 }}
          onChange={vi.fn()}
          goals={{ 'skill-g': { goal: 9, targetDate: '2026-10-05', studyPlan: [], studyPlanOther: '' } }}
          onGoalChange={vi.fn()}
        />
      )
      expect(screen.getByRole('radiogroup', { name: 'Goal for Git' })).toBeInTheDocument()
      expect(screen.getByText(/Set a goal for this skill/)).toBeInTheDocument()
    })

    it('picking 10 explicitly on a maintained skill is an explicit rating with no goal fields', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const onGoalChange = vi.fn()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={onChange} goals={{}} onGoalChange={onGoalChange} />)
      await user.click(disclosure())
      const gitGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Git' })
      await user.click(within(gitGroup).getByRole('radio', { name: '10, current rating' }))
      expect(onChange).toHaveBeenCalledWith('skill-g', 10)
      expect(onGoalChange).toHaveBeenCalledWith('skill-g', null)
    })

    it('a 10 in value shows as a selected rating (not the muted current one) with no goal fields', async () => {
      const user = userEvent.setup()
      render(
        <ConfidenceRatingPrompt skills={MAINTAINED} value={{ 'skill-g': 10 }} onChange={vi.fn()} goals={{ 'skill-g': NO_GOAL }} onGoalChange={vi.fn()} />
      )
      const gitGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Git' })
      expect(within(gitGroup).getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true')
      expect(within(gitGroup).queryByRole('radio', { name: '10, current rating' })).not.toBeInTheDocument()
      expect(screen.queryByRole('radiogroup', { name: 'Goal for Git' })).not.toBeInTheDocument()
      await user.click(within(gitGroup).getByRole('radio', { name: '10' }))
    })

    it('picking 10 on a Growing skill shows no goal fields and clears its goal', async () => {
      const user = userEvent.setup()
      const onGoalChange = vi.fn()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={onGoalChange} />)
      const reactGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for React' })
      await user.click(within(reactGroup).getByRole('radio', { name: '10' }))
      expect(onGoalChange).toHaveBeenCalledWith('skill-a', null)
      expect(screen.queryByRole('radiogroup', { name: 'Goal for React' })).not.toBeInTheDocument()
    })

    it('opens by itself when a maintained skill already has a rating in value, and can still be collapsed', async () => {
      const user = userEvent.setup()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{ 'skill-g': 7 }} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
      expect(disclosure()).toHaveAttribute('aria-expanded', 'true')
      expect(disclosure()).toBeEnabled()
      await user.click(disclosure())
      expect(disclosure()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('radiogroup', { name: 'Confidence rating for Git' })).not.toBeInTheDocument()
    })

    it('says how many ratings were changed when the row is collapsed over a changed rating', async () => {
      const user = userEvent.setup()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{ 'skill-g': 7, 'skill-h': 9 }} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />)
      await user.click(disclosure())
      expect(disclosure()).toHaveTextContent('2 ratings changed')
      expect(disclosure()).not.toHaveTextContent('Change a rating')
    })

    it('disables the disclosure-opened rating controls for observers', async () => {
      const user = userEvent.setup()
      render(<ConfidenceRatingPrompt skills={MAINTAINED} value={{}} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} disabled />)
      await user.click(disclosure())
      const gitGroup = screen.getByRole('radiogroup', { name: 'Confidence rating for Git' })
      within(gitGroup).getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled())
    })
  })
})

describe('ConfidenceRatingPrompt keyboard order', () => {
  const group = (name: string) => screen.getByRole('radiogroup', { name })

  it('each skill is one Tab stop: the chosen rating, or the first when none is chosen', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button>before</button>
        <ConfidenceRatingPrompt skills={SKILLS} value={{ 'skill-b': 4 }} onChange={vi.fn()} goals={{}} onGoalChange={vi.fn()} />
        <button>after</button>
      </>
    )
    await user.click(screen.getByRole('button', { name: 'before' }))
    await user.tab()
    expect(within(group('Confidence rating for React')).getByRole('radio', { name: '1' })).toHaveFocus()
    await user.tab()
    expect(within(group('Confidence rating for Testing')).getByRole('radio', { name: '4' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('arrow keys move focus without choosing a rating, and Space chooses and keeps focus', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ConfidenceRatingPrompt skills={SKILLS} value={{}} onChange={onChange} goals={{}} onGoalChange={vi.fn()} />)
    const react = group('Confidence rating for React')
    within(react).getByRole('radio', { name: '1' }).focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(within(react).getByRole('radio', { name: '3' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{End}')
    expect(within(react).getByRole('radio', { name: '10' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(within(react).getByRole('radio', { name: '1' })).toHaveFocus()
    await user.keyboard('{ArrowRight}{ }')
    expect(onChange).toHaveBeenCalledWith('skill-a', 2)
    expect(within(react).getByRole('radio', { name: '2' })).toHaveFocus()
  })
})

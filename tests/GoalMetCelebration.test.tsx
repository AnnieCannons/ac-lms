import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/goal-met-actions', () => ({ answerWhatHelped: vi.fn(), setSkillGoal: vi.fn() }))

import GoalMetCelebration, { type CelebrationDisplayItem } from '@/components/ui/GoalMetCelebration'
import { answerWhatHelped, setSkillGoal } from '@/lib/goal-met-actions'

const goalItem = (over: Partial<CelebrationDisplayItem> = {}, goal: Partial<NonNullable<CelebrationDisplayItem['goal']>> = {}): CelebrationDisplayItem => ({
  skillId: 's1',
  skillName: 'React',
  rating: 8,
  mastered: false,
  goal: { outcomeId: 'o1', target: 7, ownPlanText: null, nextGoalAllowed: true, ...goal },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(answerWhatHelped).mockResolvedValue({ error: null })
  vi.mocked(setSkillGoal).mockResolvedValue({ error: null })
})

describe('GoalMetCelebration', () => {
  it('renders nothing when there is nothing to celebrate', () => {
    const { container } = render(<GoalMetCelebration items={[]} onDismiss={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('names the skill and the goal reached, announces it, and asks what helped', () => {
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('You reached your goal of 7 in React!')
    expect(screen.getByRole('group', { name: /What helped you reach your goal\?.*for React/ })).toBeInTheDocument()
    // the seven fixed options
    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
  })

  it('celebrates mastery alone with no question and a pointer to bringing the skill back', () => {
    render(<GoalMetCelebration items={[{ skillId: 's1', skillName: 'Git', rating: 10, mastered: true }]} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent("You've mastered Git!")
    expect(screen.getByText(/bring it back any time from My Skill Confidence/)).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('combines a met goal and mastery into one headline, still asking once for the goal, with no next goal step', async () => {
    const user = userEvent.setup()
    render(<GoalMetCelebration items={[goalItem({ rating: 10, mastered: true }, { target: 10, nextGoalAllowed: false })]} onDismiss={vi.fn()} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent("You've mastered React, and reached your goal of 10!")
    await user.click(screen.getByRole('checkbox', { name: 'Studying flashcards' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/your answer is saved/)).toBeInTheDocument()
    expect(screen.queryByText('Set a new goal')).not.toBeInTheDocument()
  })

  it('needs at least one choice, and "Other" needs text, before Save is enabled', async () => {
    const user = userEvent.setup()
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={vi.fn()} />)
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Other' }))
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Describe what helped'), 'A study group')
    expect(save).toBeEnabled()
  })

  it('tells the notification bell to refresh once an answer is saved, and not when it fails', async () => {
    const user = userEvent.setup()
    const refresh = vi.fn()
    window.addEventListener('notifications-updated', refresh)
    vi.mocked(answerWhatHelped).mockResolvedValueOnce({ error: "We couldn't save your answer. Please try again." })
    render(<GoalMetCelebration items={[goalItem({}, { nextGoalAllowed: false })]} onDismiss={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Studying flashcards' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    expect(refresh).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/your answer is saved/)
    expect(refresh).toHaveBeenCalledTimes(1)
    window.removeEventListener('notifications-updated', refresh)
  })

  it('does not save the abandoned write-in when "Other" is unchecked again', async () => {
    const user = userEvent.setup()
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Other' }))
    await user.type(screen.getByLabelText('Describe what helped'), 'A study group')
    await user.click(screen.getByRole('checkbox', { name: 'Other' }))
    await user.click(screen.getByRole('checkbox', { name: 'Studying flashcards' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(answerWhatHelped).toHaveBeenCalledWith('o1', ['flashcards'], undefined)
  })

  it('offers the student\'s own study-plan write-in as an extra option, before "Other"', async () => {
    const user = userEvent.setup()
    render(<GoalMetCelebration items={[goalItem({}, { ownPlanText: 'Pair with a friend' })]} onDismiss={vi.fn()} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(8)
    expect(boxes[boxes.length - 2]).toHaveAccessibleName('Pair with a friend')
    expect(boxes[boxes.length - 1]).toHaveAccessibleName('Other')
    await user.click(screen.getByRole('checkbox', { name: 'Pair with a friend' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(answerWhatHelped).toHaveBeenCalledWith('o1', ['own_plan'], undefined)
  })

  it('shows a non-blaming error and keeps the question when saving fails', async () => {
    const user = userEvent.setup()
    vi.mocked(answerWhatHelped).mockResolvedValue({ error: "We couldn't save your answer. Please try again." })
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={vi.fn()} />)
    await user.click(screen.getByRole('checkbox', { name: 'Studying flashcards' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save your answer/)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('offers an optional next goal after the question, following the submission rules, and saves it', async () => {
    const user = userEvent.setup()
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(answerWhatHelped).not.toHaveBeenCalled()
    expect(screen.getByText('Set a new goal')).toBeInTheDocument()

    // Suggested at rating + 2, and nothing at or below the current rating is offered.
    expect(screen.getByRole('radio', { name: 'Goal 10' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('radio', { name: 'Goal 8' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Goal 9' })).toBeInTheDocument()

    const setGoal = screen.getByRole('button', { name: 'Set goal' })
    expect(setGoal).toBeDisabled() // study plan still required
    await user.click(screen.getByRole('checkbox', { name: 'Study flashcards' }))
    await user.click(setGoal)
    expect(setSkillGoal).toHaveBeenCalledWith('s1', expect.objectContaining({ goal: 10, studyPlan: ['flashcards'] }))
    expect(await screen.findByText(/Your new goal is set/)).toBeInTheDocument()
  })

  it('lets the student skip the next goal with a Skip beside the heading, and has no Not now button', async () => {
    const user = userEvent.setup()
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    const heading = screen.getByText('Set a new goal')
    expect(within(heading.parentElement!).getByRole('button', { name: 'Skip' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument()
    expect(setSkillGoal).not.toHaveBeenCalled()
    expect(screen.queryByText('Set a new goal')).not.toBeInTheDocument()
  })

  it('celebrates several skills together in one card, each with its own question', () => {
    render(
      <GoalMetCelebration
        items={[goalItem(), goalItem({ skillId: 's2', skillName: 'Git', rating: 10, mastered: true, goal: undefined })]}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getAllByRole('region', { name: 'Goal celebration' })).toHaveLength(1)
    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(screen.getAllByRole('group', { name: /What helped/ })).toHaveLength(1)
  })

  it('can be dismissed', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<GoalMetCelebration items={[goalItem()]} onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'Dismiss celebration' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

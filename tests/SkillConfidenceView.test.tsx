import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SkillTrend } from '@/lib/confidence-trend'

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    LineChart: Stub, Line: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub,
    ReferenceLine: Stub, ResponsiveContainer: Stub,
  }
})
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/goal-met-actions', () => ({ answerWhatHelped: vi.fn(), setSkillGoal: vi.fn() }))

import SkillConfidenceView from '@/components/ui/SkillConfidenceView'
import { answerWhatHelped, setSkillGoal } from '@/lib/goal-met-actions'

const trend = (over: Partial<SkillTrend> = {}): SkillTrend => ({
  skillId: 's1',
  name: 'React',
  ratings: [
    { value: 4, date: '2026-02-01T10:00:00Z', assignmentTitle: 'Hooks 1', courseId: 'c1', courseName: 'Frontend', isCurrentCourse: false },
    { value: 6, date: '2026-03-01T10:00:00Z', assignmentTitle: null, courseId: 'c1', courseName: 'Frontend', isCurrentCourse: false },
  ],
  startCourseName: 'Frontend',
  courseBreakpoints: [],
  currentGoal: null,
  previousGoals: [],
  reachedTens: [],
  isMaintaining: false,
  latestRating: 6,
  goalStatus: 'none',
  canSetGoal: false,
  ...over,
})

// A skill whose latest rating is 10.
const maintaining = (over: Partial<SkillTrend> = {}) =>
  trend({ skillId: 's9', name: 'Git', isMaintaining: true, latestRating: 10, ...over })

const ten = (over: Record<string, unknown> = {}) => ({
  outcomeId: 'ot1', metAt: '2026-04-01T10:00:00Z', rating: 10, answered: false, answerLabels: [] as string[], answerValues: [] as string[], ...over,
})

const GROWING = /^Choose skills to view/
const MAINTAINING = /^Choose maintained skills to view/
// Kept under the old name so the shared helpers below read the same.
const ACTIVE = GROWING

// Opens a section's dropdown and ticks the named skills, then closes it.
const pick = async (user: ReturnType<typeof userEvent.setup>, combo: RegExp, ...names: string[]) => {
  await user.click(screen.getByRole('combobox', { name: combo }))
  for (const name of names) await user.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }))
  await user.keyboard('{Escape}')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(answerWhatHelped).mockResolvedValue({ error: null })
  vi.mocked(setSkillGoal).mockResolvedValue({ error: null })
})

describe('SkillConfidenceView', () => {
  it('shows a friendly empty state when the student has no ratings', () => {
    render(<SkillConfidenceView trends={[]} canEdit />)
    expect(screen.getByText('No skill ratings yet')).toBeInTheDocument()
  })

  it('has Growing and Maintaining sections, each with an empty chart and no cards by default', () => {
    render(<SkillConfidenceView trends={[trend(), maintaining()]} canEdit />)
    expect(screen.getByRole('heading', { name: "Skills you're growing" })).toHaveAttribute('id', 'skills-growing')
    expect(screen.getByRole('heading', { name: "Skills you're maintaining" })).toHaveAttribute('id', 'skills-maintaining')
    expect(screen.getByText('Select a skill above to see your progress and history.')).toBeInTheDocument()
    expect(screen.getByText('Select a skill above to see its history.')).toBeInTheDocument()
    expect(screen.queryByText(/All ratings/)).not.toBeInTheDocument()
  })

  it('shows the number of skills next to each section title', () => {
    render(<SkillConfidenceView trends={[trend(), trend({ skillId: 's2', name: 'CSS' }), maintaining()]} canEdit />)
    const growing = screen.getByRole('heading', { name: "Skills you're growing" }).parentElement!
    expect(within(growing).getByText('2 skills')).toBeInTheDocument()
    const kept = screen.getByRole('heading', { name: "Skills you're maintaining" }).parentElement!
    expect(within(kept).getByText('1 skill')).toBeInTheDocument()
  })

  it('never mentions mastery or reactivation anywhere', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), maintaining()]} canEdit />)
    await pick(user, GROWING, 'React')
    await pick(user, MAINTAINING, 'Git')
    expect(document.body.textContent).not.toMatch(/mastered|mastery|reactivat/i)
    expect(screen.queryByRole('button', { name: /Reactivate/ })).not.toBeInTheDocument()
  })

  it('puts a skill below 10 only in Growing and a skill at 10 only in Maintaining', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), maintaining()]} canEdit />)
    await user.click(screen.getByRole('combobox', { name: GROWING }))
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['React'])
    await user.click(screen.getByRole('combobox', { name: MAINTAINING }))
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Git'])
  })

  it('has the new picker placeholders', () => {
    render(<SkillConfidenceView trends={[trend(), maintaining()]} canEdit />)
    expect(screen.getByPlaceholderText('Search your skills…')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search maintained skills…')).toBeInTheDocument()
  })

  it('filters the dropdown as the student types and says when nothing matches', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), trend({ skillId: 's2', name: 'CSS Grid' }), trend({ skillId: 's3', name: 'Canva' })]} canEdit />)
    await user.click(screen.getByRole('combobox', { name: GROWING }))
    await user.type(screen.getByRole('combobox', { name: GROWING }), 'gri')
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['CSS Grid'])
    await user.clear(screen.getByRole('combobox', { name: GROWING }))
    await user.type(screen.getByRole('combobox', { name: GROWING }), 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/No skills match/)).toBeInTheDocument()
  })

  it('shows only the chosen skills, lets several be chosen, and removing a chip hides the skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), trend({ skillId: 's2', name: 'CSS' }), maintaining()]} canEdit />)
    await pick(user, GROWING, 'React')
    expect(screen.getByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'CSS' })).not.toBeInTheDocument()
    await pick(user, GROWING, 'CSS')
    expect(screen.getByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CSS' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove React' }))
    expect(screen.queryByRole('region', { name: 'React' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CSS' })).toBeInTheDocument()
  })

  it('keeps the two sections independent', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), maintaining()]} canEdit />)
    await pick(user, GROWING, 'React')
    expect(screen.queryByRole('region', { name: 'Git' })).not.toBeInTheDocument()
    expect(screen.getByText('Select a skill above to see its history.')).toBeInTheDocument()
  })

  it('says so when a section has no skills instead of showing an empty picker', () => {
    const { unmount } = render(<SkillConfidenceView trends={[trend()]} canEdit />)
    expect(screen.getByText('No skills here yet — a skill lands here once you rate it a 10.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: MAINTAINING })).not.toBeInTheDocument()
    unmount()

    render(<SkillConfidenceView trends={[maintaining()]} canEdit />)
    expect(screen.getByText("You don't have any skills you're growing right now.")).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: GROWING })).not.toBeInTheDocument()
  })

  it('lists each rating with date and assignment, and a generic label for a removed assignment', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend()]} canEdit />)
    await pick(user, GROWING, 'React')
    expect(screen.getByText('Hooks 1')).toBeInTheDocument()
    expect(screen.getByText('Removed assignment')).toBeInTheDocument()
  })

  it('shows the current goal with its plan and target date, plainly, even when the date has passed', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({
      currentGoal: { id: 'g1', met: null, ownPlanText: null, goal: 8, isMaintain: false, targetDate: '2020-01-05', studyPlanLabels: ['Study flashcards'], setAt: '2026-02-01T10:00:00Z' },
    })]} />)
    await pick(user, GROWING, 'React')
    expect(screen.getByText('Current goal')).toBeInTheDocument()
    expect(screen.getByText('Target date')).toBeInTheDocument()
    expect(screen.getByText('Jan 5, 2020')).toBeInTheDocument()
    expect(screen.getByText('8 / 10')).toBeInTheDocument()
    const panel = within(screen.getByText('Current goal').parentElement!)
    expect(panel.getByText('Date set')).toBeInTheDocument()
    expect(panel.getByText('Feb 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('Planned study methods')).toBeInTheDocument()
    expect(screen.getByText('Study flashcards')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/overdue|congrat|goal met|great job/i)
  })

  it('shows the goal panel for a skill without a goal, saying none is set', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend()]} canEdit />)
    await pick(user, GROWING, 'React')
    expect(screen.getByText('Current goal')).toBeInTheDocument()
    expect(screen.getByText('No goal set for this skill yet.')).toBeInTheDocument()
    expect(screen.queryByText('Target date')).not.toBeInTheDocument()
    expect(screen.queryByText('Planned study methods')).not.toBeInTheDocument()
  })

  it('shows a Maintaining card with the gentle note, and no goal panel or Set a goal', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[maintaining()]} />)
    await pick(user, MAINTAINING, 'Git')
    const card = screen.getByRole('region', { name: 'Git' })
    expect(within(card).getByText("You're maintaining this rating.")).toBeInTheDocument()
    expect(within(card).getByText(/pick a lower rating on a future assignment/)).toBeInTheDocument()
    expect(within(card).queryByText('Current goal')).not.toBeInTheDocument()
    expect(within(card).queryByText('No goal set for this skill yet.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set a goal' })).not.toBeInTheDocument()
  })

  it('keeps a maintained skill\'s earlier goals, and its old maintain marker, in the goal history', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[maintaining({
      previousGoals: [
        { id: 'g1', goal: 10, isMaintain: false, targetDate: '2026-03-01', studyPlanLabels: [], ownPlanText: null, setAt: '2026-02-01T10:00:00Z',
          met: { outcomeId: 'o1', metAt: '2026-03-02T10:00:00Z', rating: 10, answered: true, answerLabels: ['Studying flashcards'], answerValues: ['flashcards'] } },
        { id: 'g0', met: null, ownPlanText: null, goal: null, isMaintain: true, targetDate: null, studyPlanLabels: [], setAt: '2026-01-01T10:00:00Z' },
      ],
    })]} />)
    await pick(user, MAINTAINING, 'Git')
    expect(screen.getByText('Earlier goals (2)')).toBeInTheDocument()
    expect(screen.queryByText('Current goal')).not.toBeInTheDocument()
  })

  it('shows the times a skill got to 10, with their answers, in a closed details', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[maintaining({
      reachedTens: [ten({ outcomeId: 'ot2', answered: true, answerLabels: ['Studying flashcards'], answerValues: ['flashcards'] }), ten()],
    })]} />)
    await pick(user, MAINTAINING, 'Git')
    const summary = screen.getByText('Times you got to 10 (2)')
    const details = within(summary.closest('details')!)
    expect(details.getByText('Studying flashcards')).toBeInTheDocument()
    expect(details.getByText('What helped: Not answered yet')).toBeInTheDocument()
  })

  it('labels the planned study methods in an earlier goal, separately from the "what helped" answer', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({
      previousGoals: [
        { ...metGoal(), studyPlanLabels: ['Watch outside tutorials or videos'], met: { outcomeId: 'o1', metAt: '2026-03-02T10:00:00Z', rating: 8, answered: true, answerLabels: ['Studying flashcards'], answerValues: ['flashcards'] } },
        { id: 'g0', met: null, ownPlanText: null, goal: 8, isMaintain: false, targetDate: '2026-03-03', studyPlanLabels: ['Study flashcards', 'Other: Pair programming'], setAt: '2026-01-01T10:00:00Z' },
      ],
    })]} />)
    await pick(user, GROWING, 'React')
    const history = within(screen.getByText('Earlier goals (2)').closest('details')!)
    expect(history.getAllByText('Planned study methods:')).toHaveLength(2)
    expect(history.getAllByText('What helped:')).toHaveLength(1) // only the reached goal has an answer
    // the study method is listed under its own label, before (and apart from) the answer
    const studyMethod = history.getByText('Watch outside tutorials or videos')
    expect(studyMethod.closest('div')!.textContent).toMatch(/^Planned study methods:/)
    expect(history.getByText('Studying flashcards').closest('div')!.textContent).toMatch(/^What helped:/)
  })

  it('keeps earlier goals viewable as history', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({
      previousGoals: [{ id: 'g1', met: null, ownPlanText: null, goal: 4, isMaintain: false, targetDate: '2026-03-03', studyPlanLabels: [], setAt: '2026-02-01T10:00:00Z' }],
    })]} />)
    await pick(user, GROWING, 'React')
    expect(screen.getByText('Earlier goals (1)')).toBeInTheDocument()
  })

  it('moves a skill between sections when its latest rating changes', () => {
    const { rerender } = render(<SkillConfidenceView trends={[maintaining()]} canEdit />)
    expect(screen.getByText("You don't have any skills you're growing right now.")).toBeInTheDocument()
    rerender(<SkillConfidenceView trends={[maintaining({ isMaintaining: false, latestRating: 7 })]} canEdit />)
    expect(screen.getByText('No skills here yet — a skill lands here once you rate it a 10.')).toBeInTheDocument()
  })
})

const metGoal = (over: Record<string, unknown> = {}) => ({
  id: 'g1', goal: 7, isMaintain: false, targetDate: '2026-03-01', studyPlanLabels: [], ownPlanText: null, setAt: '2026-02-01T10:00:00Z',
  met: { outcomeId: 'o1', metAt: '2026-03-02T10:00:00Z', rating: 8, answered: false, answerLabels: [] as string[], answerValues: [] as string[] },
  ...over,
})

// The banner above the tabs opens a dialog listing the goals waiting for an answer.
// The "Log what helped" button on one skill's row in that dialog.
const answerButtonFor = (list: HTMLElement, skillName: string) =>
  within(within(list).getByText(new RegExp(`${skillName}: you reached`)).closest('li')!).getByRole('button', { name: 'Log what helped' })

const openWaitingGoals = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Log what helped' }))
  return screen.getByRole('dialog', { name: 'Log what helped' })
}

describe('SkillConfidenceView goal follow-ups', () => {
  it('shows a banner above the tabs, a list of waiting goals in a dialog, and the follow-up beside the skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' })]} />)
    const banner = screen.getByRole('region', { name: 'Goals waiting for a What helped answer' })
    expect(banner).toHaveAttribute('id', 'what-helped')
    expect(within(banner).getByText('1 reached goal is waiting for you to log what helped.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const dialog = await openWaitingGoals(user)
    expect(within(dialog).getByText(/React: you reached your goal of 7 on Mar 2, 2026\./)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Invalid Date/)
    await user.keyboard('{Escape}')

    await pick(user, ACTIVE, 'React')
    expect(screen.getByText('You reached your goal of 7 in React.')).toBeInTheDocument()
  })

  const twoWaiting = () => [
    trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' }),
    trend({ skillId: 's2', name: 'CSS', currentGoal: null, previousGoals: [metGoal({ id: 'g2', met: { outcomeId: 'o2', metAt: '2026-03-03T10:00:00Z', rating: 9, answered: false, answerLabels: [], answerValues: [] } })], goalStatus: 'met' }),
  ]

  it('goes back to the list of waiting goals after skipping an answer', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={twoWaiting()} />)
    const list = await openWaitingGoals(user)
    await user.click(answerButtonFor(list, 'React'))
    expect(screen.queryByRole('dialog', { name: 'Log what helped' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('dialog', { name: 'React' })).getByRole('button', { name: 'Skip for now' }))
    const back = screen.getByRole('dialog', { name: 'Log what helped' })
    expect(within(back).getAllByRole('button', { name: 'Log what helped' })).toHaveLength(2)
  })

  it('goes back to the list when the answer form is closed with Escape', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={twoWaiting()} />)
    await user.click(answerButtonFor(await openWaitingGoals(user), 'React'))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Log what helped' })).toBeInTheDocument()
  })

  it('goes back to the list after saving an answer, without the goal just answered', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={twoWaiting()} />)
    await user.click(answerButtonFor(await openWaitingGoals(user), 'React'))
    const form = screen.getByRole('dialog', { name: 'React' })
    await user.click(within(form).getByRole('checkbox', { name: 'Reviewing class notes' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    const back = await screen.findByRole('dialog', { name: 'Log what helped' })
    expect(within(back).getAllByRole('button', { name: 'Log what helped' })).toHaveLength(1)
    expect(within(back).queryByText(/React: you reached/)).not.toBeInTheDocument()
    expect(within(back).getByText(/CSS: you reached/)).toBeInTheDocument()
  })

  it('closes the list once the last waiting goal is answered', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' })]} />)
    await user.click(within(await openWaitingGoals(user)).getByRole('button', { name: 'Log what helped' }))
    const form = screen.getByRole('dialog', { name: 'React' })
    await user.click(within(form).getByRole('checkbox', { name: 'Reviewing class notes' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('answering from a skill\'s own card goes back to the page, not the list', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={twoWaiting()} />)
    await pick(user, ACTIVE, 'React')
    const card = screen.getByText('You reached your goal of 7 in React.').closest('div')!
    await user.click(within(card).getByRole('button', { name: 'Log what helped' }))
    await user.click(within(screen.getByRole('dialog', { name: 'React' })).getByRole('button', { name: 'Skip for now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('counts several waiting goals in the banner', () => {
    render(<SkillConfidenceView canEdit trends={[
      trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' }),
      trend({ skillId: 's2', name: 'CSS', currentGoal: null, previousGoals: [metGoal({ id: 'g2', met: { outcomeId: 'o2', metAt: '2026-03-03T10:00:00Z', rating: 9, answered: false, answerLabels: [], answerValues: [] } })], goalStatus: 'met' }),
    ]} />)
    expect(screen.getByText('2 reached goals are waiting for you to log what helped.')).toBeInTheDocument()
  })

  it('has no banner when nothing is waiting for an answer', () => {
    render(<SkillConfidenceView canEdit trends={[trend()]} />)
    expect(screen.queryByRole('button', { name: 'Log what helped' })).not.toBeInTheDocument()
    expect(screen.queryByText(/waiting for you to log what helped/)).not.toBeInTheDocument()
  })

  it('answers from the summary, saving the options, then refreshes', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' })]} />)
    await user.click(within(await openWaitingGoals(user)).getByRole('button', { name: 'Log what helped' }))
    const dialog = screen.getByRole('dialog', { name: 'React' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Reviewing class notes' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(answerWhatHelped).toHaveBeenCalledWith('o1', ['review_notes'], undefined))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('moves a reached goal out of "Current goal" into "Earlier goals", with "No goal set yet" and a Set a goal button beside it', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met', canSetGoal: true })]} />)
    await pick(user, ACTIVE, 'React')
    const panel = within(screen.getByText('Current goal').parentElement!)
    expect(panel.getByText('No goal set for this skill yet.')).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Set a goal' })).toBeInTheDocument()
    expect(panel.queryByText('Reached')).not.toBeInTheDocument()
    expect(screen.getByText('Earlier goals (1)')).toBeInTheDocument()
  })

  it('renders its dialog outside the vertically spaced page container, so the backdrop covers the whole screen', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' })]} />)
    await user.click(within(await openWaitingGoals(user)).getByRole('button', { name: 'Log what helped' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.closest('.space-y-12')).toBeNull()
  })

  it('shows the answer read-only in the goal history once answered, and no follow-up', async () => {
    const user = userEvent.setup()
    const answered = metGoal({ met: { outcomeId: 'o1', metAt: '2026-03-02T10:00:00Z', rating: 8, answered: true, answerLabels: ['Studying flashcards', 'Other: A study group'], answerValues: ['flashcards', 'other'] } })
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [answered], goalStatus: 'met' })]} />)
    expect(screen.queryByText(/waiting for you to log what helped/)).not.toBeInTheDocument()
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText('Studying flashcards')).toBeInTheDocument()
    expect(screen.getByText('Other: A study group')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log what helped' })).not.toBeInTheDocument()
  })

  it('offers "Set a goal" only when allowed, and saves it following the submission rules', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ canSetGoal: true })]} />)
    await pick(user, ACTIVE, 'React')
    await user.click(screen.getByRole('button', { name: 'Set a goal' }))
    const dialog = screen.getByRole('dialog', { name: 'Set a goal for React' })
    // latest rating is 6: suggested 8, nothing at or below 6 offered
    expect(within(dialog).getByRole('radio', { name: 'Goal 8' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).queryByRole('radio', { name: 'Goal 6' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Study flashcards' }))
    await user.click(within(dialog).getByRole('button', { name: 'Set goal' }))
    await waitFor(() => expect(setSkillGoal).toHaveBeenCalledWith('s1', expect.objectContaining({ goal: 8, studyPlan: ['flashcards'] })))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('puts "Set a goal" inside the goal panel, beside "No goal set for this skill yet."', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ canSetGoal: true })]} />)
    await pick(user, ACTIVE, 'React')
    const panel = within(screen.getByText('Current goal').parentElement!)
    expect(panel.getByText('No goal set for this skill yet.')).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Set a goal' })).toBeInTheDocument()
  })

  it('does not offer "Set a goal" on a skill that cannot take one', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ canSetGoal: false })]} />)
    await pick(user, ACTIVE, 'React')
    expect(screen.queryByRole('button', { name: 'Set a goal' })).not.toBeInTheDocument()
  })

  it('disables answering and goal-setting for staff previewing the page', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit={false} trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met', canSetGoal: true })]} />)
    expect(within(await openWaitingGoals(user)).getByRole('button', { name: 'Log what helped' })).toBeDisabled()
    await user.keyboard('{Escape}')
    await pick(user, ACTIVE, 'React')
    expect(screen.getByRole('button', { name: 'Set a goal' })).toBeDisabled()
  })

  it('words an unanswered return to 10 (no target) in the card, the banner list and the dialog', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[maintaining({ reachedTens: [ten()] })]} />)
    expect(screen.getByText('1 reached goal is waiting for you to log what helped.')).toBeInTheDocument()
    const dialog = await openWaitingGoals(user)
    expect(within(dialog).getByText('Git: you got to 10 on Apr 1, 2026.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await pick(user, MAINTAINING, 'Git')
    expect(screen.getByText('You got to 10 in Git.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set a goal' })).not.toBeInTheDocument()
  })

  it('saves an answer for a return to 10 from its follow-up', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[maintaining({ reachedTens: [ten()] })]} />)
    await user.click(within(await openWaitingGoals(user)).getByRole('button', { name: 'Log what helped' }))
    const form = screen.getByRole('dialog', { name: 'Git' })
    await user.click(within(form).getByRole('checkbox', { name: 'Reviewing class notes' }))
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(answerWhatHelped).toHaveBeenCalledWith('ot1', ['review_notes'], undefined))
  })

  it('disables the follow-up button on a card for staff viewers', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit={false} trends={[maintaining({ reachedTens: [ten()] })]} />)
    await pick(user, MAINTAINING, 'Git')
    const card = screen.getByRole('region', { name: 'Git' })
    expect(within(card).getByRole('button', { name: 'Log what helped' })).toBeDisabled()
    expect(within(card).getByText('Only the student can do this.')).toBeInTheDocument()
  })
})

describe('SkillConfidenceView patterns tab', () => {
  const answered = () => metGoal({ met: { outcomeId: 'o1', metAt: '2026-03-02T10:00:00Z', rating: 8, answered: true, answerLabels: ['Studying flashcards'], answerValues: ['flashcards'] } })
  const openPatterns = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('tab', { name: 'Patterns' }))

  it('opens on the Skills tab, with the patterns section hidden until Patterns is chosen', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [answered()], goalStatus: 'met' })]} />)
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: "Skills you're growing" })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What tends to help you' })).not.toBeInTheDocument()
    await openPatterns(user)
    expect(screen.getByRole('tab', { name: 'Patterns' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'What tends to help you' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: "Skills you're growing" })).not.toBeInTheDocument()
  })

  it('switches tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend()]} />)
    screen.getByRole('tab', { name: 'Skills' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Patterns' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Patterns' })).toHaveFocus()
  })

  it('keeps the "What helped?" banner above the tabs, on either tab', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' })]} />)
    expect(screen.getByRole('button', { name: 'Log what helped' })).toBeInTheDocument()
    await openPatterns(user)
    expect(screen.getByRole('button', { name: 'Log what helped' })).toBeInTheDocument()
  })

  it('remembers picked skills when switching tabs and back', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend()]} />)
    await pick(user, ACTIVE, 'React')
    await openPatterns(user)
    await user.click(screen.getByRole('tab', { name: 'Skills' }))
    expect(screen.queryByText('Select a skill above to see your progress and history.')).not.toBeInTheDocument()
  })

  it('shows the gentle note in the empty state, on the Patterns tab', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[]} />)
    expect(screen.getByText('No skill ratings yet')).toBeInTheDocument()
    await openPatterns(user)
    expect(screen.getByRole('heading', { name: 'What tends to help you' })).toBeInTheDocument()
    expect(screen.getByText(/Patterns will show up here as you reach goals/)).toBeInTheDocument()
  })

  it('shows the gentle note when no reached goal has been answered', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit trends={[trend({ currentGoal: null, previousGoals: [metGoal()], goalStatus: 'met' })]} />)
    await openPatterns(user)
    expect(screen.getByText(/Patterns will show up here as you reach goals/)).toBeInTheDocument()
  })

  it('shows counts from answered goals, including for a viewer who cannot edit', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canEdit={false} trends={[trend({ currentGoal: null, previousGoals: [answered()], goalStatus: 'met' })]} />)
    await openPatterns(user)
    expect(screen.getByText('Helped 1 time')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: /helped on/ })).getByText('React').closest('li')).toHaveTextContent('React: 1')
  })
})

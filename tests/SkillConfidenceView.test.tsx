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
vi.mock('@/lib/confidence-trend-actions', () => ({ reactivateConfidenceSkill: vi.fn() }))

import SkillConfidenceView from '@/components/ui/SkillConfidenceView'
import { reactivateConfidenceSkill } from '@/lib/confidence-trend-actions'

const trend = (over: Partial<SkillTrend> = {}): SkillTrend => ({
  skillId: 's1',
  name: 'React',
  ratings: [
    { value: 4, date: '2026-02-01T10:00:00Z', assignmentTitle: 'Hooks 1', courseId: 'c1', courseName: 'Frontend', isCurrentCourse: false },
    { value: 6, date: '2026-03-01T10:00:00Z', assignmentTitle: null, courseId: 'c1', courseName: 'Frontend', isCurrentCourse: false },
  ],
  startCourseName: 'Frontend',
  courseBreakpoints: [],
  events: [],
  currentGoal: null,
  previousGoals: [],
  isMastered: false,
  previouslyMastered: false,
  masteredDates: [],
  reactivatedDates: [],
  pendingNew: false,
  latestRating: 6,
  ...over,
})

const mastered = (over: Partial<SkillTrend> = {}) =>
  trend({ skillId: 's9', name: 'Git', isMastered: true, masteredDates: ['2026-03-01T10:00:01Z'], latestRating: 10, ...over })

const ACTIVE = /^Choose skills to view/
const MASTERED = /^Choose mastered skills to view/

// Opens a section's dropdown and ticks the named skills, then closes it.
const pick = async (user: ReturnType<typeof userEvent.setup>, combo: RegExp, ...names: string[]) => {
  await user.click(screen.getByRole('combobox', { name: combo }))
  for (const name of names) await user.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }))
  await user.keyboard('{Escape}')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(reactivateConfidenceSkill).mockResolvedValue({ error: null })
})

describe('SkillConfidenceView', () => {
  it('shows a friendly empty state when the student has no ratings', () => {
    render(<SkillConfidenceView trends={[]} canReactivate />)
    expect(screen.getByText('No skill ratings yet')).toBeInTheDocument()
  })

  it('has separately titled sections, each with an empty chart and no cards by default', () => {
    render(<SkillConfidenceView trends={[trend(), mastered()]} canReactivate />)
    expect(screen.getByRole('heading', { name: "Skills you're working on" })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mastered skills' })).toBeInTheDocument()
    expect(screen.getByText('Select a skill above to see your progress and history.')).toBeInTheDocument()
    expect(screen.getByText('Select a mastered skill above to see its history, or to reactivate it.')).toBeInTheDocument()
    expect(screen.queryByText(/All ratings/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('shows the number of skills next to each section title', () => {
    render(<SkillConfidenceView trends={[trend(), trend({ skillId: 's2', name: 'CSS' }), mastered()]} canReactivate />)
    const working = screen.getByRole('heading', { name: "Skills you're working on" }).parentElement!
    expect(within(working).getByText('2 skills')).toBeInTheDocument()
    const done = screen.getByRole('heading', { name: 'Mastered skills' }).parentElement!
    expect(within(done).getByText('1 skill')).toBeInTheDocument()
  })

  it('does not mention confidence dropping or "not mastered yet" in the section descriptions', () => {
    render(<SkillConfidenceView trends={[trend(), mastered()]} canReactivate />)
    expect(document.body.textContent).not.toMatch(/confidence has dropped|haven't mastered/i)
  })

  it('lists only unmastered skills in the first dropdown and only mastered skills in the second', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), mastered()]} canReactivate />)
    await user.click(screen.getByRole('combobox', { name: ACTIVE }))
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['React'])
    await user.click(screen.getByRole('combobox', { name: MASTERED }))
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Git'])
  })

  it('filters the dropdown as the student types and says when nothing matches', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), trend({ skillId: 's2', name: 'CSS Grid' }), trend({ skillId: 's3', name: 'Canva' })]} canReactivate />)
    await user.click(screen.getByRole('combobox', { name: ACTIVE }))
    await user.type(screen.getByRole('combobox', { name: ACTIVE }), 'gri')
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['CSS Grid'])
    await user.clear(screen.getByRole('combobox', { name: ACTIVE }))
    await user.type(screen.getByRole('combobox', { name: ACTIVE }), 'zzz')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/No skills match/)).toBeInTheDocument()
  })

  it('shows only the chosen skills, lets several be chosen, and removing a chip hides the skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), trend({ skillId: 's2', name: 'CSS' }), mastered()]} canReactivate />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'CSS' })).not.toBeInTheDocument()
    await pick(user, ACTIVE, 'CSS')
    expect(screen.getByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CSS' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove React' }))
    expect(screen.queryByRole('region', { name: 'React' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CSS' })).toBeInTheDocument()
  })

  it('keeps the two sections independent', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), mastered()]} canReactivate />)
    await pick(user, ACTIVE, 'React')
    expect(screen.queryByRole('region', { name: 'Git' })).not.toBeInTheDocument()
    expect(screen.getByText('Select a mastered skill above to see its history, or to reactivate it.')).toBeInTheDocument()
  })

  it('says so when a section has no skills instead of showing an empty picker', () => {
    render(<SkillConfidenceView trends={[trend()]} canReactivate />)
    expect(screen.getByText(/No mastered skills yet/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: MASTERED })).not.toBeInTheDocument()

    render(<SkillConfidenceView trends={[mastered()]} canReactivate />)
    expect(screen.getByText("You don't have any skills in progress right now.")).toBeInTheDocument()
  })

  it('lists each rating with date and assignment, and a generic label for a removed assignment', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend()]} canReactivate />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText('Hooks 1')).toBeInTheDocument()
    expect(screen.getByText('Removed assignment')).toBeInTheDocument()
  })

  it('shows the current goal with its plan and target date, plainly, even when the date has passed', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canReactivate trends={[trend({
      currentGoal: { goal: 8, isMaintain: false, targetDate: '2020-01-05', studyPlanLabels: ['Study flashcards'], setAt: '2026-02-01T10:00:00Z' },
    })]} />)
    await pick(user, ACTIVE, 'React')
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

  it('shows a maintaining goal without a date or plan', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canReactivate trends={[trend({
      currentGoal: { goal: null, isMaintain: true, targetDate: null, studyPlanLabels: [], setAt: '2026-02-01T10:00:00Z' },
    })]} />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText(/Maintaining this rating/)).toBeInTheDocument()
    expect(screen.queryByText('Target date')).not.toBeInTheDocument()
    expect(screen.queryByText('Planned study methods')).not.toBeInTheDocument()
  })

  it('shows the goal panel for a skill without a goal, saying none is set', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend()]} canReactivate />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText('Current goal')).toBeInTheDocument()
    expect(screen.getByText('No goal set for this skill yet.')).toBeInTheDocument()
    expect(screen.queryByText('Target date')).not.toBeInTheDocument()
    expect(screen.queryByText('Planned study methods')).not.toBeInTheDocument()
  })

  it('tells a reactivated skill it will get a new goal on its next rating', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend({ previouslyMastered: true, pendingNew: true, masteredDates: ['2026-03-01T10:00:01Z'], reactivatedDates: ['2026-04-01T10:00:00Z'] })]} canReactivate />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText("You'll set a new goal the next time you rate this skill.")).toBeInTheDocument()
  })

  it('shows the goal panel on mastered skills too', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[mastered()]} canReactivate />)
    await pick(user, MASTERED, 'Git')
    expect(screen.getByText('Current goal')).toBeInTheDocument()
  })

  it('keeps earlier goals viewable as history', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canReactivate trends={[trend({
      previousGoals: [{ goal: 4, isMaintain: false, targetDate: '2026-03-03', studyPlanLabels: [], setAt: '2026-02-01T10:00:00Z' }],
    })]} />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText('Earlier goals (1)')).toBeInTheDocument()
  })

  it('offers Reactivate only on a chosen mastered skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[trend(), mastered()]} canReactivate />)
    await pick(user, ACTIVE, 'React')
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    await pick(user, MASTERED, 'Git')
    const card = screen.getByRole('region', { name: 'Git' })
    expect(within(card).getByRole('button', { name: 'Reactivate' })).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Reactivate' })).toHaveLength(1)
    expect(within(card).getByText(/Mastered Mar 1, 2026/)).toBeInTheDocument()
  })

  it('shows a previously mastered skill in the working-on section with dates and no Reactivate button', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView canReactivate trends={[trend({
      previouslyMastered: true, pendingNew: true,
      masteredDates: ['2026-03-01T10:00:01Z'], reactivatedDates: ['2026-04-01T10:00:00Z'],
    })]} />)
    await pick(user, ACTIVE, 'React')
    expect(screen.getByText(/Previously mastered Mar 1, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/reactivated Apr 1, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/come back as a new skill/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
  })

  it('confirms before reactivating, then calls the action and refreshes', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[mastered()]} canReactivate />)
    await pick(user, MASTERED, 'Git')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    expect(reactivateConfidenceSkill).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/earlier ratings, goal, and the date you mastered it are kept/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(reactivateConfidenceSkill).toHaveBeenCalledWith('s9'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    // The mastered card is dismissed (the skill now lives in the working-on section).
    expect(screen.queryByRole('region', { name: 'Git' })).not.toBeInTheDocument()
  })

  it('shows a clear error, keeps the dialog open, and does not refresh when reactivation fails', async () => {
    vi.mocked(reactivateConfidenceSkill).mockResolvedValue({ error: "We couldn't reactivate this skill. Please try again." })
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[mastered()]} canReactivate />)
    await pick(user, MASTERED, 'Git')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reactivate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't reactivate")
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Git' })).toBeInTheDocument()
  })

  it('disables Reactivate for staff viewers so nothing can be changed from preview', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceView trends={[mastered()]} canReactivate={false} />)
    await pick(user, MASTERED, 'Git')
    const button = screen.getByRole('button', { name: 'Reactivate' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(reactivateConfidenceSkill).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SkillTrend } from '@/lib/confidence-trend'
import { computeClassStats } from '@/lib/confidence-trend'
import type { CourseTrendStudent, CourseTrendSkill } from '@/lib/confidence-trend-data'

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    LineChart: Stub, Line: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub,
    ReferenceLine: Stub, ResponsiveContainer: Stub,
  }
})

import SkillConfidenceInstructorView from '@/components/ui/SkillConfidenceInstructorView'

const trend = (skillId: string, name: string, over: Partial<SkillTrend> = {}): SkillTrend => ({
  skillId, name,
  ratings: [
    { value: 3, date: '2026-01-10T10:00:00Z', assignmentTitle: 'Old project', courseId: 'c0', courseName: 'Intro', isCurrentCourse: false },
    { value: 6, date: '2026-05-10T10:00:00Z', assignmentTitle: 'New project', courseId: 'c1', courseName: 'Frontend', isCurrentCourse: true },
  ],
  startCourseName: 'Intro',
  courseBreakpoints: [{ x: 1.5, label: 'Frontend' }],
  events: [], currentGoal: null, previousGoals: [],
  isMastered: false, previouslyMastered: false, masteredDates: [], reactivatedDates: [], pendingNew: false,
  latestRating: 6, goalStatus: 'none', canSetGoal: false, ...over,
})

const skills: CourseTrendSkill[] = [
  { id: 's1', name: 'React', stats: computeClassStats([2, 5, 8]) },
  { id: 's2', name: 'CSS', stats: computeClassStats([7]) },
]
const students: CourseTrendStudent[] = [
  { id: 'u1', name: 'Ada', trends: [trend('s1', 'React'), trend('s2', 'CSS')] },
  { id: 'u2', name: 'Grace', trends: [trend('s1', 'React', { isMastered: true, masteredDates: ['2026-05-11T10:00:00Z'] })] },
  { id: 'u3', name: 'Linus', trends: [] },
]

// Opens a searchable dropdown and clicks one of its options.
const choose = async (user: ReturnType<typeof userEvent.setup>, combo: RegExp, option: string) => {
  await user.click(screen.getByRole('combobox', { name: combo }))
  await user.click(screen.getByRole('option', { name: option }))
}

const openStudentsTab = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('tab', { name: /By student/ }))

describe('SkillConfidenceInstructorView', () => {
  it('has three tabs, Class overview (selected by default), By student and Patterns', () => {
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual(['Class overview', 'By student3', 'Patterns'])
    expect(screen.getByRole('tab', { name: 'Class overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /By student/ })).toHaveAttribute('aria-selected', 'false')
    // Only the selected tab's panel is shown.
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'skill-panel-overview')
    expect(screen.queryByText('Linus')).not.toBeInTheDocument()
  })

  it('switches between the tabs by click and by arrow keys', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'skill-panel-students')
    expect(screen.queryByRole('heading', { name: 'React', level: 3 })).not.toBeInTheDocument()
    screen.getByRole('tab', { name: /By student/ }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Class overview' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /By student/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('moves between all three tabs with arrow keys (wrapping) and Home/End', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    screen.getByRole('tab', { name: 'Class overview' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Patterns' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Class overview' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Patterns' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Class overview' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows a students-rated count, average and median for every skill on the overview tab', () => {
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    const react = screen.getByRole('heading', { name: 'React', level: 3 }).closest('div')!.parentElement!
    expect(within(react).getByText('3 students rated')).toBeInTheDocument()
    expect(react.textContent).toContain('Average 5 · Median 5')
    const css = screen.getByRole('heading', { name: 'CSS', level: 3 }).closest('div')!.parentElement!
    expect(within(css).getByText('1 student rated')).toBeInTheDocument()
  })

  it('lists students with no ratings as having no data instead of omitting them', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    const linus = within(screen.getByRole('list')).getByText('Linus').closest('li')!
    expect(within(linus).getByText('No ratings yet')).toBeInTheDocument()
  })

  it('expands and collapses a student row to show and hide their skills', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    const roster = within(screen.getByRole('list'))
    expect(screen.queryByRole('region', { name: 'React' })).not.toBeInTheDocument()
    await user.click(roster.getByText('Ada'))
    expect(await screen.findByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'CSS' })).toBeInTheDocument()
    await user.click(roster.getByText('Ada'))
    expect(screen.queryByRole('region', { name: 'React' })).not.toBeInTheDocument()
  })

  it('expands and collapses every student with ratings at once', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    // Ada (2 skills) + Grace (1 skill) are open; Linus has no ratings and stays a plain row.
    expect(await screen.findAllByRole('region', { name: 'React' })).toHaveLength(2)
    expect(screen.getAllByRole('region', { name: 'CSS' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryByRole('region', { name: 'React' })).not.toBeInTheDocument()
  })

  it('shows earlier-course ratings as read-only context inside a student\'s drill-in', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    await user.click(within(screen.getByRole('list')).getByText('Ada'))
    expect(await screen.findAllByText('Earlier course (read-only)')).toHaveLength(2)
    expect(screen.getAllByText('Old project').length).toBeGreaterThan(0)
  })

  it('never offers a Reactivate control, even for a mastered skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    await user.click(within(screen.getByRole('list')).getByText('Grace'))
    expect(await screen.findByText(/Mastered May 11, 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reactivate/i })).not.toBeInTheDocument()
  })

  it('only offers skills that have a rating from this course in the skill filter', async () => {
    const user = userEvent.setup()
    // Legacy was rated only in an earlier course, so the class overview has no card for it.
    const withLegacy: CourseTrendStudent[] = [
      { ...students[0], trends: [...students[0].trends, trend('s3', 'Legacy', { ratings: [{ value: 7, date: '2026-01-10T10:00:00Z', assignmentTitle: 'Old', courseId: 'c0', courseName: 'Intro', isCurrentCourse: false }] })] },
      ...students.slice(1),
    ]
    render(<SkillConfidenceInstructorView students={withLegacy} skills={skills} />)
    const optionNames = () => within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)
    await user.click(screen.getByRole('combobox', { name: /^Skills/ }))
    expect(optionNames()).toEqual(['React', 'CSS'])
    await user.keyboard('{Escape}')
    await openStudentsTab(user)
    await user.click(screen.getByRole('combobox', { name: /^Skills/ }))
    expect(optionNames()).toEqual(['React', 'CSS'])
    await user.keyboard('{Escape}')
    // Legacy still shows in the student's expanded row when viewing all skills.
    await user.click(within(screen.getByRole('list')).getByText('Ada'))
    expect(await screen.findByRole('region', { name: 'Legacy' })).toBeInTheDocument()
  })

  it('shows how many students are at each rating when hovering or focusing a bar', () => {
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    const react = screen.getByRole('heading', { name: 'React', level: 3 }).closest('div')!.parentElement!
    // React's latest ratings are 2, 5 and 8 (one student each); nobody is at 1.
    expect(within(react).getByLabelText('1 student rated 5')).toBeInTheDocument()
    expect(within(react).getByLabelText('0 students rated 1')).toBeInTheDocument()
    // The visible pop-up just says how many students.
    const tips = within(react).getAllByRole('tooltip').map(t => t.textContent)
    expect(tips).toContain('1 student')
    expect(tips).toContain('0 students')
  })

  it('sorts the overview cards by name and by class average', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    const order = () => screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    expect(order()).toEqual(['CSS', 'React']) // Name A–Z is the default
    await user.selectOptions(screen.getByLabelText(/Sort/), 'name-desc')
    expect(order()).toEqual(['React', 'CSS'])
    // React averages 5, CSS 7.
    await user.selectOptions(screen.getByLabelText(/Sort/), 'rating-asc')
    expect(order()).toEqual(['React', 'CSS'])
    await user.selectOptions(screen.getByLabelText(/Sort/), 'rating-desc')
    expect(order()).toEqual(['CSS', 'React'])
  })

  it('sorts the By student tab by name and by rating, with unrated students last', async () => {
    const user = userEvent.setup()
    const rated = (value: number) => trend('s1', 'React', {
      ratings: [
        { value: 1, date: '2026-01-10T10:00:00Z', assignmentTitle: 'Old', courseId: 'c0', courseName: 'Intro', isCurrentCourse: false },
        { value, date: '2026-05-10T10:00:00Z', assignmentTitle: 'New', courseId: 'c1', courseName: 'Frontend', isCurrentCourse: true },
      ],
    })
    const roster: CourseTrendStudent[] = [
      { id: 'a', name: 'Ada', trends: [rated(8)] },
      { id: 'b', name: 'Bo', trends: [rated(3)] },
      { id: 'c', name: 'Cy', trends: [] },
      { id: 'd', name: 'Di', trends: [rated(5)] },
    ]
    render(<SkillConfidenceInstructorView students={roster} skills={skills} />)
    await openStudentsTab(user)
    const names = () => within(screen.getByRole('list')).getAllByRole('listitem').map(li => li.querySelector('span')?.textContent)
    expect(names()).toEqual(['Ada', 'Bo', 'Cy', 'Di'])
    await user.selectOptions(screen.getByLabelText(/Sort/), 'name-desc')
    expect(names()).toEqual(['Di', 'Cy', 'Bo', 'Ada'])
    // Only ratings from this course count, so Bo (3) < Di (5) < Ada (8); Cy has none and stays last.
    await user.selectOptions(screen.getByLabelText(/Sort/), 'rating-asc')
    expect(names()).toEqual(['Bo', 'Di', 'Ada', 'Cy'])
    await user.selectOptions(screen.getByLabelText(/Sort/), 'rating-desc')
    expect(names()).toEqual(['Ada', 'Di', 'Bo', 'Cy'])
  })

  it('keeps the chosen sort when switching tabs', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await user.selectOptions(screen.getByLabelText(/Sort/), 'name-desc')
    await openStudentsTab(user)
    expect(screen.getByLabelText(/Sort/)).toHaveValue('name-desc')
  })

  it('starts with no skills picked, which shows every skill, and the student filter on "all"', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    expect(screen.getByRole('combobox', { name: /^Skills/ })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: /^Skills/ })).toHaveAttribute('placeholder', 'All skills')
    expect(screen.getByRole('heading', { name: 'React', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CSS', level: 3 })).toBeInTheDocument()
    await openStudentsTab(user)
    expect(screen.getByRole('combobox', { name: /^Skills/ })).toHaveAttribute('placeholder', 'All skills')
    expect(screen.getByRole('combobox', { name: /^Student/ })).toHaveValue('All students')
  })

  it('lets you search the skill and student dropdowns by typing', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await user.click(screen.getByRole('combobox', { name: /^Skills/ }))
    await user.type(screen.getByRole('combobox', { name: /^Skills/ }), 'cs')
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)).toEqual(['CSS'])
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Remove CSS' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'React', level: 3 })).not.toBeInTheDocument()

    await openStudentsTab(user)
    await user.click(screen.getByRole('combobox', { name: /^Student/ }))
    await user.type(screen.getByRole('combobox', { name: /^Student/ }), 'gra')
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)).toEqual(['Grace'])
    await user.type(screen.getByRole('combobox', { name: /^Student/ }), 'zzz')
    expect(screen.getByText(/No matches/)).toBeInTheDocument()
  })

  it('shows every skill again when the picked skills are removed', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await choose(user, /^Skills/, 'CSS')
    expect(screen.queryByRole('heading', { name: 'React', level: 3 })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove CSS' }))
    expect(screen.getByRole('heading', { name: 'React', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CSS', level: 3 })).toBeInTheDocument()
  })

  it('removes a picked skill when its chip is clicked anywhere, not just on the \u2715', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await choose(user, /^Skills/, 'CSS')
    expect(screen.queryByRole('heading', { name: 'React', level: 3 })).not.toBeInTheDocument()
    await user.click(screen.getByText('CSS', { selector: 'button[aria-label="Remove CSS"]' }))
    expect(screen.queryByRole('button', { name: 'Remove CSS' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'React', level: 3 })).toBeInTheDocument()
  })

  it('lets you pick several skills at once and shows only those', async () => {
    const user = userEvent.setup()
    const threeSkills: CourseTrendSkill[] = [...skills, { id: 's3', name: 'Git', stats: computeClassStats([4]) }]
    const cohort: CourseTrendStudent[] = [{ id: 'u1', name: 'Ada', trends: [trend('s1', 'React'), trend('s2', 'CSS'), trend('s3', 'Git')] }]
    render(<SkillConfidenceInstructorView students={cohort} skills={threeSkills} />)
    await user.click(screen.getByRole('combobox', { name: /^Skills/ }))
    // The list stays open, so a second skill is picked without reopening it.
    await user.click(screen.getByRole('option', { name: 'React' }))
    await user.click(screen.getByRole('option', { name: 'Git' }))
    expect(screen.getByRole('button', { name: 'Remove React' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Git' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'React', level: 3 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Git', level: 3 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'CSS', level: 3 })).not.toBeInTheDocument()
    // The same picks narrow a student's skill cards on the By student tab.
    await user.keyboard('{Escape}')
    await openStudentsTab(user)
    await user.click(within(screen.getByRole('list')).getByText('Ada'))
    await user.click(screen.getByText('Skills', { selector: 'summary span' }))
    expect(screen.getByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Git' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'CSS' })).not.toBeInTheDocument()
  })

  it('narrows the overview by skill, and the choice carries over to the By student tab', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await choose(user, /^Skills/, 'CSS')
    expect(screen.queryByRole('heading', { name: 'React', level: 3 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CSS', level: 3 })).toBeInTheDocument()
    await openStudentsTab(user)
    expect(within(within(screen.getByRole('list')).getByText('Grace').closest('li')!).getByText('No ratings for this skill')).toBeInTheDocument()
  })

  it('narrows the By student tab to one student', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openStudentsTab(user)
    await choose(user, /^Student/, 'Ada')
    const list = within(screen.getByRole('list'))
    expect(list.getByText('Ada')).toBeInTheDocument()
    expect(list.queryByText('Grace')).not.toBeInTheDocument()
    expect(list.queryByText('Linus')).not.toBeInTheDocument()
  })

  it('explains when nobody is enrolled', () => {
    render(<SkillConfidenceInstructorView students={[]} skills={[]} />)
    expect(screen.getByText(/No students are currently enrolled/)).toBeInTheDocument()
  })
})

describe('SkillConfidenceInstructorView goal outcomes', () => {
  it('shows a reached goal and its answer read-only, or "Not answered yet", with no controls', async () => {
    const user = userEvent.setup()
    const goalWith = (answered: boolean) => ({
      id: 'g1', goal: 7, isMaintain: false, targetDate: '2026-03-01', studyPlanLabels: [], ownPlanText: null, setAt: '2026-02-01T10:00:00Z',
      met: { outcomeId: 'o1', metAt: '2026-03-02T10:00:00Z', rating: 8, answered, answerLabels: answered ? ['Studying flashcards'] : [], answerValues: answered ? ['flashcards'] : [] },
    })
    const cohort: CourseTrendStudent[] = [
      { id: 'u1', name: 'Ada', trends: [trend('s1', 'React', { currentGoal: goalWith(true), goalStatus: 'met', canSetGoal: true })] },
      { id: 'u2', name: 'Grace', trends: [trend('s1', 'React', { currentGoal: goalWith(false), goalStatus: 'met', canSetGoal: true })] },
    ]
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await openStudentsTab(user)
    await user.click(screen.getByText('Ada'))
    await user.click(screen.getByText('Grace'))
    // Once in Ada's goal history; the patterns sections above repeat the method name.
    expect(screen.getAllByText('Studying flashcards').length).toBeGreaterThan(0)
    expect(screen.getByText(/What helped: Not answered yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /answer|set a goal|reactivate/i })).not.toBeInTheDocument()
  })
})

describe('SkillConfidenceInstructorView patterns', () => {
  const goalWith = (id: string, values: string[]) => ({
    id, goal: 7, isMaintain: false, targetDate: '2026-03-01', studyPlanLabels: [], ownPlanText: null, setAt: '2026-02-01T10:00:00Z',
    met: { outcomeId: `o-${id}`, metAt: '2026-03-02T10:00:00Z', rating: 8, answered: true, answerLabels: values.map(v => `Label ${v}`), answerValues: values },
  })
  const cohort: CourseTrendStudent[] = [
    { id: 'u1', name: 'Ada', trends: [trend('s1', 'React', { previousGoals: [goalWith('g1', ['flashcards'])] }), trend('s2', 'CSS', { previousGoals: [goalWith('g2', ['ta_help'])] })] },
    { id: 'u2', name: 'Grace', trends: [trend('s1', 'React', { previousGoals: [goalWith('g3', ['flashcards'])] })] },
    { id: 'u3', name: 'Linus', trends: [] },
  ]
  const openPatternsTab = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('tab', { name: 'Patterns' }))

  it('shows class-level counts without naming any student', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await openPatternsTab(user)
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'skill-panel-patterns')
    expect(screen.getByRole('heading', { name: 'What tends to help students' })).toBeInTheDocument()
    expect(screen.getByText('Helped 2 times')).toBeInTheDocument()
    expect(screen.getByText('Helped 1 time')).toBeInTheDocument()
    expect(screen.getByText(/based on 3 times where students logged what helped, from 2 students/)).toBeInTheDocument()
    const panel = screen.getByRole('tabpanel')
    for (const name of ['Ada', 'Grace', 'Linus']) expect(within(panel).queryByText(name)).not.toBeInTheDocument()
    expect(within(panel).queryByText(/Label /)).not.toBeInTheDocument()
  })

  it('narrows by skill and ignores the student filter', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await user.click(screen.getByRole('tab', { name: /By student/ }))
    await choose(user, /Student/, 'Linus')
    await openPatternsTab(user)
    // The student filter chosen on the other tab does not narrow the class view.
    expect(screen.getByText(/from 2 students/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Student/ })).not.toBeInTheDocument()
    await choose(user, /^Skills/, 'CSS')
    expect(screen.getByText(/based on 1 time where students logged what helped, from 1 student/)).toBeInTheDocument()
    expect(screen.queryByText('Studying flashcards')).not.toBeInTheDocument()
    expect(screen.getByText('Getting help from an Instructor or a TA')).toBeInTheDocument()
  })

  it('shows a neutral note when nobody has logged what helped', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await openPatternsTab(user)
    expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument()
  })

  it('shows a student their own patterns when expanded, and a neutral note when they have none', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await user.click(screen.getByRole('tab', { name: /By student/ }))
    const roster = within(screen.getByRole('list'))
    await user.click(roster.getByText('Ada'))
    const adaRow = roster.getByText('Ada').closest('li')!
    expect(within(adaRow).getByText('What tends to help this student')).toBeInTheDocument()
    expect(within(adaRow).getByText('Studying flashcards')).toBeInTheDocument()
    expect(within(adaRow).getByText('Getting help from an Instructor or a TA')).toBeInTheDocument()
  })

  it('shows only the neutral note for a student with ratings but no answers', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={[{ id: 'u9', name: 'Ida', trends: [trend('s1', 'React')] }]} skills={skills} />)
    await user.click(screen.getByRole('tab', { name: /By student/ }))
    await user.click(screen.getByText('Ida'))
    expect(await screen.findByText(/Nothing logged yet/)).toBeInTheDocument()
  })

  it('offers no answer, set-goal or reactivate controls on the patterns views', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await openPatternsTab(user)
    expect(screen.queryByRole('button', { name: /answer|set a goal|reactivate|log what helped/i })).not.toBeInTheDocument()
  })

  it('splits an expanded student into two collapsible parts, both closed to begin with', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await user.click(screen.getByRole('tab', { name: /By student/ }))
    const roster = within(screen.getByRole('list'))
    await user.click(roster.getByText('Ada'))
    const adaRow = roster.getByText('Ada').closest('li')!
    // The skill cards hold their own details blocks, so find each part from its title.
    const helpPart = within(adaRow).getByText('What tends to help this student').closest('details') as HTMLDetailsElement
    const skillsPart = within(adaRow).getByText('Skills').closest('details') as HTMLDetailsElement
    expect(helpPart).not.toBe(skillsPart)
    expect(helpPart.open).toBe(false)
    expect(skillsPart.open).toBe(false)
    // Each opens on its own without affecting the other.
    await user.click(within(helpPart).getByText('What tends to help this student'))
    expect(helpPart.open).toBe(true)
    expect(skillsPart.open).toBe(false)
    await user.click(within(skillsPart).getByText('Skills'))
    expect(skillsPart.open).toBe(true)
    expect(within(skillsPart).getByRole('region', { name: 'React' })).toBeInTheDocument()
    expect(within(helpPart).queryByRole('region', { name: 'React' })).not.toBeInTheDocument()
  })

  it('shows each skill closed, with only its name and latest rating in the summary, until opened', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={cohort} skills={skills} />)
    await user.click(screen.getByRole('tab', { name: /By student/ }))
    const roster = within(screen.getByRole('list'))
    await user.click(roster.getByText('Ada'))
    const adaRow = roster.getByText('Ada').closest('li')!
    const react = within(adaRow).getByRole('region', { name: 'React' })
    const card = react.querySelector(':scope > details') as HTMLDetailsElement
    expect(card.open).toBe(false)
    const summary = card.querySelector(':scope > summary')!
    expect(summary).toHaveTextContent('React')
    expect(summary).toHaveTextContent('Latest rating 6 / 10')
    expect(summary).not.toHaveTextContent(/Current goal|All ratings/)
    await user.click(summary)
    expect(card.open).toBe(true)
    expect(within(react).getByText(/All ratings/)).toBeInTheDocument()
  })

  it('orders a student\'s skill cards by the page Sort, by name or by the latest rating each card shows', async () => {
    const user = userEvent.setup()
    // Ratings chosen so every Sort setting gives an order different from the one before it.
    const mixed: CourseTrendStudent[] = [{
      id: 'u1', name: 'Ada',
      trends: [trend('s1', 'React', { latestRating: 4 }), trend('s2', 'CSS', { latestRating: 9 }), trend('s3', 'Git', { latestRating: 7 })],
    }]
    render(<SkillConfidenceInstructorView students={mixed} skills={skills} />)
    await user.click(screen.getByRole('tab', { name: /By student/ }))
    const roster = within(screen.getByRole('list'))
    await user.click(roster.getByText('Ada'))
    const adaRow = roster.getByText('Ada').closest('li')!
    await user.click(within(adaRow).getByText('Skills'))
    const order = () => within(adaRow).getAllByRole('heading', { level: 3 }).map(h => h.textContent)
    const sortBy = (value: string) => user.selectOptions(screen.getByRole('combobox', { name: /Sort/ }), value)

    expect(order()).toEqual(['CSS', 'Git', 'React'])      // Name A-Z (default)
    await sortBy('rating-asc')
    expect(order()).toEqual(['React', 'Git', 'CSS'])      // 4, 7, 9
    await sortBy('rating-desc')
    expect(order()).toEqual(['CSS', 'Git', 'React'])      // 9, 7, 4
    await sortBy('name-desc')
    expect(order()).toEqual(['React', 'Git', 'CSS'])
  })
})

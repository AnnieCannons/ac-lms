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
  latestRating: 6, ...over,
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

describe('SkillConfidenceInstructorView', () => {
  it('shows a students-rated count, average and median for every skill', () => {
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    const react = screen.getByRole('heading', { name: 'React', level: 3 }).closest('div')!.parentElement!
    expect(within(react).getByText('3 students rated')).toBeInTheDocument()
    expect(react.textContent).toContain('Average 5 · Median 5')
    const css = screen.getByRole('heading', { name: 'CSS', level: 3 }).closest('div')!.parentElement!
    expect(within(css).getByText('1 student rated')).toBeInTheDocument()
  })

  it('lists students with no ratings as having no data instead of omitting them', () => {
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    const linus = within(screen.getByRole('list')).getByText('Linus').closest('li')!
    expect(within(linus).getByText('No ratings yet')).toBeInTheDocument()
  })

  it('shows earlier-course ratings as read-only context inside a student\'s drill-in', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await user.click(within(screen.getByRole('list')).getByText('Ada'))
    expect(await screen.findAllByText('Earlier course (read-only)')).toHaveLength(2)
    expect(screen.getAllByText('Old project').length).toBeGreaterThan(0)
  })

  it('never offers a Reactivate control, even for a mastered skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await user.click(within(screen.getByRole('list')).getByText('Grace'))
    expect(await screen.findByText(/Mastered May 11, 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reactivate/i })).not.toBeInTheDocument()
  })

  it('narrows the view by skill', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await user.selectOptions(screen.getAllByRole('combobox')[0], 's2')
    expect(screen.queryByRole('heading', { name: 'React', level: 3 })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'CSS', level: 3 })).toBeInTheDocument()
    expect(within(within(screen.getByRole('list')).getByText('Grace').closest('li')!).getByText('No ratings for this skill')).toBeInTheDocument()
  })

  it('narrows the view by student', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={students} skills={skills} />)
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'u1')
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

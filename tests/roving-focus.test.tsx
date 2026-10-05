import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GoalState } from '@/lib/confidence-tracker-validation'
import { computeClassStats } from '@/lib/confidence-trend'

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return { LineChart: Stub, Line: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, ReferenceLine: Stub, ResponsiveContainer: Stub }
})

import GoalFields from '@/components/ui/GoalFields'
import SkillConfidenceInstructorView from '@/components/ui/SkillConfidenceInstructorView'

const blank = (goal: number | null): GoalState => ({ goal, targetDate: '2030-01-01', studyPlan: [], studyPlanOther: '' })

function GoalHarness({ initial = null }: { initial?: number | null }) {
  const [state, setState] = useState<GoalState>(blank(initial))
  return (
    <>
      <button>before</button>
      <GoalFields
        skillId="s1" skillName="React" rating={5} goalState={state}
        onGoalChange={patch => setState(prev => (patch === null ? blank(null) : { ...prev, ...patch }))}
      />
      <button>after</button>
    </>
  )
}

describe('goal choices keyboard order', () => {
  it('is a single Tab stop: Tab goes past the whole group, not through each number', async () => {
    const user = userEvent.setup()
    render(<GoalHarness />)
    await user.click(screen.getByRole('button', { name: 'before' }))
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Goal 6' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('the one Tab stop is the chosen goal when there is one', async () => {
    const user = userEvent.setup()
    render(<GoalHarness initial={8} />)
    await user.click(screen.getByRole('button', { name: 'before' }))
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Goal 8' })).toHaveFocus()
  })

  it('arrow keys, Home and End move focus (with wrap) without choosing a goal', async () => {
    const user = userEvent.setup()
    render(<GoalHarness />)
    screen.getByRole('radio', { name: 'Goal 6' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Goal 7' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Goal 10' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Goal 6' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Goal 10' })).toHaveFocus()
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  it('Space chooses the focused goal and focus stays on it', async () => {
    const user = userEvent.setup()
    render(<GoalHarness />)
    screen.getByRole('radio', { name: 'Goal 6' }).focus()
    await user.keyboard('{ArrowRight}{ }')
    const seven = screen.getByRole('radio', { name: 'Goal 7' })
    expect(seven).toHaveAttribute('aria-checked', 'true')
    expect(seven).toHaveFocus()
  })
})

describe('class overview chart bars', () => {
  const skills = [
    { id: 's1', name: 'React', stats: computeClassStats([2, 5, 8]) },
    { id: 's2', name: 'CSS', stats: computeClassStats([7]) },
  ]

  it('each card has one Tab stop, and arrow keys step through its bars', async () => {
    const user = userEvent.setup()
    render(<SkillConfidenceInstructorView students={[{ id: 'u1', name: 'Ada', trends: [] }]} skills={skills} />)
    const bars = Array.from(document.querySelectorAll<HTMLElement>('[data-bar]'))
    expect(bars).toHaveLength(20)
    expect(bars.filter(b => b.getAttribute('tabindex') === '0')).toHaveLength(2)

    const firstBars = bars.slice(0, 10)
    firstBars[0].focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(firstBars[2]).toHaveFocus()
    // The Tab stop follows where focus last was.
    expect(firstBars[2]).toHaveAttribute('tabindex', '0')
    expect(firstBars[0]).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{End}')
    expect(firstBars[9]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(firstBars[0]).toHaveFocus()
  })
})

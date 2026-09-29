import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { SkillTrend } from '@/lib/confidence-trend'

// Stub recharts so the structure (scroll wrapper, labels) can be asserted without a layout engine.
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    LineChart: ({ children, width }: { children?: React.ReactNode; width?: number }) => <div data-testid="line-chart" data-width={width}>{children}</div>,
    Line: Stub, XAxis: Stub, YAxis: ({ hide }: { hide?: boolean }) => <span data-testid={hide ? 'y-axis-hidden' : 'y-axis'} />,
    CartesianGrid: Stub, Tooltip: Stub, ResponsiveContainer: Stub,
    ReferenceLine: ({ label }: { label?: { value?: string } }) => <span data-testid="ref-label">{label?.value}</span>,
  }
})

import SkillTrendChart from '@/components/ui/SkillTrendChart'

const trend = (count: number, over: Partial<SkillTrend> = {}): SkillTrend => ({
  skillId: 's1', name: 'React',
  ratings: Array.from({ length: count }, (_, i) => ({
    value: (i % 9) + 1, date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), assignmentTitle: `A${i}`,
    courseId: 'c1', courseName: 'Frontend', isCurrentCourse: false,
  })),
  startCourseName: 'Frontend', courseBreakpoints: [], events: [], currentGoal: null, previousGoals: [],
  isMastered: false, previouslyMastered: false, masteredDates: [], reactivatedDates: [], pendingNew: false,
  latestRating: 5, ...over,
})

describe('SkillTrendChart', () => {
  it('writes the first course\'s name at the start of the chart', () => {
    render(<SkillTrendChart trend={trend(3)} />)
    expect(screen.getAllByTestId('ref-label').map(l => l.textContent)).toContain('Frontend')
  })

  it('labels each later course after its divider, in addition to the start label', () => {
    render(<SkillTrendChart trend={trend(4, { courseBreakpoints: [{ x: 2.5, label: 'Advanced' }] })} />)
    const labels = screen.getAllByTestId('ref-label').map(l => l.textContent)
    expect(labels).toEqual(expect.arrayContaining(['Frontend', 'Advanced']))
  })

  it('shows no start label when the first rating\'s course is unknown', () => {
    render(<SkillTrendChart trend={trend(3, { startCourseName: null })} />)
    expect(screen.queryAllByTestId('ref-label')).toHaveLength(0)
  })

  it('squeezes up to 29 ratings into the width of the card', () => {
    render(<SkillTrendChart trend={trend(29)} />)
    expect(screen.queryByTestId('trend-chart-scroll')).not.toBeInTheDocument()
  })

  it('scrolls sideways from 30 ratings, with a fixed vertical axis and a wider plot without one', () => {
    render(<SkillTrendChart trend={trend(30)} />)
    const scroller = screen.getByTestId('trend-chart-scroll')
    expect(scroller).toBeInTheDocument()
    // One chart draws only the fixed y-axis; the scrolling one hides its own and is wider than 30 steps.
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis-hidden')).toBeInTheDocument()
    const widths = screen.getAllByTestId('line-chart').map(c => Number(c.getAttribute('data-width')))
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(30 * 30)
  })
})

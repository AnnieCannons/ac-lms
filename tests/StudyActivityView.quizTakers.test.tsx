import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StudyActivityView from '@/components/ui/StudyActivityView'

// The weekly chart isn't under test, and recharts needs a real layout to render
vi.mock('recharts', () => {
  const Stub = () => null
  return { BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, ResponsiveContainer: Stub }
})

const at = (date: string) => `${date}T19:00:00Z`

describe('StudyActivityView — By practice quiz', () => {
  it('expands a quiz to show who took it', () => {
    render(
      <StudyActivityView
        courseId="c1"
        students={[{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bo' }]}
        quizzes={[{ id: 'q1', title: 'CSS Overview', moduleTitle: 'Week 4' }]}
        attempts={[
          { studentId: 'a', quizId: 'q1', at: at('2026-10-20'), score: 40 },
          { studentId: 'a', quizId: 'q1', at: at('2026-10-21'), score: 100 },
        ]}
        sessions={[]}
        today="2026-10-22"
        courseStart="2026-09-01"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'By practice quiz' }))
    const toggle = screen.getByRole('button', { name: /CSS Overview/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Ana' })).toBeNull()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/instructor/courses/c1/roster/a')
    expect(screen.getByText(/2 attempts · first 40% · best 100% · last yesterday/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bo' })).toBeNull()
  })
})

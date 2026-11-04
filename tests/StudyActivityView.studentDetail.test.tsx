import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import StudyActivityView from '@/components/ui/StudyActivityView'

vi.mock('recharts', () => {
  const Stub = () => null
  return {
    BarChart: Stub, Bar: Stub, LineChart: Stub, Line: Stub, XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, ResponsiveContainer: Stub,
  }
})

const at = (date: string) => `${date}T19:00:00Z`

const view = () =>
  render(
    <StudyActivityView
      courseId="c1"
      students={[{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bo' }]}
      quizzes={[{ id: 'q1', title: 'Flexbox', moduleTitle: 'Week 3' }]}
      attempts={[
        { studentId: 'a', quizId: 'q1', at: at('2026-10-06'), score: 40 },
        { studentId: 'a', quizId: 'q1', at: at('2026-10-21'), score: 100 },
      ]}
      sessions={[{ studentId: 'a', at: at('2026-10-14'), cards: 30, deck: 'CSS basics' }]}
      today="2026-10-22"
      courseStart="2026-10-05"
    />,
  )

describe('StudyActivityView — one student', () => {
  it('finding a student by name opens what they studied, day by day', () => {
    view()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a student' }), { target: { value: 'an' } })
    expect(screen.queryByRole('button', { name: /Bo/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Ana/ })).toHaveAttribute('aria-expanded', 'true')

    const list = screen.getByRole('heading', { name: 'What they studied' }).parentElement!
    const days = within(list).getAllByRole('listitem').filter(li => li.parentElement?.tagName === 'OL')
    expect(days.map(d => d.textContent)).toEqual([
      expect.stringMatching(/Wed, Oct 21.*Flexbox.*1 attempt: 100%/),
      expect.stringMatching(/Wed, Oct 14.*CSS basics.*30 cards/),
      expect.stringMatching(/Tue, Oct 6.*Flexbox.*1 attempt: 40%/),
    ])
    // The weekly chart's data is also there as a table for screen readers
    const table = screen.getByRole('table', { name: 'Days Ana studied each week' })
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 3)
  })

  it('shows the latest week day by day, and the arrows step back a week', () => {
    view()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a student' }), { target: { value: 'an' } })
    expect(screen.getByRole('heading', { name: 'Day by day · week of Oct 19' })).toBeInTheDocument()
    const wed = screen.getByRole('button', { name: 'Wed, Oct 21: 1 practice quiz attempt. Show what they studied' })
    const target = document.getElementById('study-day-a-2026-10-21')!
    target.scrollIntoView = vi.fn()
    fireEvent.click(wed)
    expect(target.scrollIntoView).toHaveBeenCalled()
    expect(target).toHaveFocus()
    expect(screen.getByLabelText('Fri, Oct 23: outside the range')).toBeInTheDocument()
    expect(screen.getByLabelText('Mon, Oct 19: no studying')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(screen.getByRole('heading', { name: 'Day by day · week of Oct 12' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Wed, Oct 14: 30 flashcards/ })).toBeInTheDocument()
  })

  it('says so when no one matches', () => {
    view()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a student' }), { target: { value: 'zz' } })
    expect(screen.getByText('No students match “zz”.')).toBeInTheDocument()
  })
})

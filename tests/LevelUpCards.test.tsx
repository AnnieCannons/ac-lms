import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import LevelUpCards from '@/components/ui/LevelUpCards'
import type { LevelUpLink } from '@/lib/level-up-links'

const link = (over: Partial<LevelUpLink>): LevelUpLink => ({
  id: Math.random().toString(36), course_id: null, platform: 'codecademy', title: 'Course', url: 'https://example.com',
  description: null, order: 0, published: true, ...over,
})

describe('LevelUpCards', () => {
  it('shows the study tools and every platform card, with org links for the pro platforms', () => {
    render(<LevelUpCards courseId="c1" links={[]} practiceQuizCount={2} />)
    expect(screen.getByRole('link', { name: /flashcards/i })).toHaveAttribute('href', '/flashcards?from=%2Fstudent%2Fcourses%2Fc1%2Flevel-up')
    expect(screen.getByRole('link', { name: /practice quizzes/i })).toHaveAttribute('href', '/student/courses/c1/level-up/practice')
    expect(screen.getByText(/2 ungraded quizzes/)).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /open udemy/i })).toHaveAttribute('href', 'https://anniecannons.udemy.com/organization/home/')
    expect(screen.getByRole('link', { name: /open pluralsight/i })).toHaveAttribute('href', expect.stringContaining('pa-anniecannons-inc'))
    expect(screen.getByRole('link', { name: /open master\.dev/i })).toHaveAttribute('href', 'https://master.dev/')
    expect(screen.getByRole('link', { name: /open codecademy/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open freecodecamp/i })).toBeInTheDocument()
    expect(screen.getAllByText('Pro account included')).toHaveLength(3)
    // No "other" links → no "More recommended courses" card
    expect(screen.queryByText('More recommended courses')).not.toBeInTheDocument()
  })

  it('lists recommended courses on their platform card, opening in a new tab', () => {
    render(<LevelUpCards courseId="c1" practiceQuizCount={0} links={[
      link({ platform: 'freecodecamp', title: 'Responsive Web Design', url: 'https://www.freecodecamp.org/learn/2022/responsive-web-design/', description: 'Start here' }),
      link({ platform: 'other', title: 'MDN Learn', url: 'https://developer.mozilla.org/en-US/docs/Learn' }),
    ]} />)
    const fcc = screen.getByRole('region', { name: 'freeCodeCamp' })
    const course = within(fcc).getByRole('link', { name: /responsive web design/i })
    expect(course).toHaveAttribute('href', 'https://www.freecodecamp.org/learn/2022/responsive-web-design/')
    expect(course).toHaveAttribute('target', '_blank')
    expect(course).toHaveAttribute('rel', 'noopener noreferrer')
    expect(within(fcc).getByText('Start here')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'More recommended courses' })).getByRole('link', { name: /mdn learn/i })).toBeInTheDocument()
    expect(screen.getByText(/None have been added yet/)).toBeInTheDocument()
  })
})

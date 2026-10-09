import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const nav = { pathname: '/student/courses/c1' }
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: () => new Promise(() => {}) } }),
}))

import StudentCourseNav from '@/components/ui/StudentCourseNav'

const levelUpLink = () => screen.getByRole('link', { name: /level up your skills/i })

beforeEach(() => {
  localStorage.clear()
  nav.pathname = '/student/courses/c1'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-10T12:00:00'))
})
afterEach(() => vi.useRealTimers())

describe('StudentCourseNav — Level Up "New" badge', () => {
  it('shows New until the student opens Level Up, then stays gone', () => {
    const { unmount } = render(<StudentCourseNav courseId="c1" courseName="ITP" />)
    expect(levelUpLink()).toHaveTextContent('New')
    unmount()

    nav.pathname = '/student/courses/c1/level-up'
    const second = render(<StudentCourseNav courseId="c1" courseName="ITP" />)
    expect(levelUpLink()).not.toHaveTextContent('New')
    second.unmount()

    nav.pathname = '/student/courses/c1/quizzes'
    render(<StudentCourseNav courseId="c1" courseName="ITP" />)
    expect(levelUpLink()).not.toHaveTextContent('New')
  })

  it('switches itself off after Nov 30, 2026', () => {
    vi.setSystemTime(new Date('2026-12-01T09:00:00'))
    render(<StudentCourseNav courseId="c1" courseName="ITP" />)
    expect(levelUpLink()).not.toHaveTextContent('New')
  })
})

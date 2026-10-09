import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const state = { pathname: '/student/courses/c1', userId: 'student-a' }
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) },
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: () => ({ then: (cb: (r: { data: null }) => void) => cb({ data: null }) }) }
      return q
    },
  }),
}))

import StudentCourseNav from '@/components/ui/StudentCourseNav'

const levelUpLink = () => screen.getByRole('link', { name: /level up your skills/i })
const renderNav = () => render(<StudentCourseNav courseId="c1" courseName="ITP" />)
// The badge only appears once the logged-in user is known (async), so wait for it
const expectNew = async () => expect(await screen.findByText('New')).toBeInTheDocument()
const expectNoNew = async () => {
  await new Promise(r => setTimeout(r, 0))
  expect(levelUpLink()).not.toHaveTextContent('New')
}

beforeEach(() => {
  localStorage.clear()
  Object.assign(state, { pathname: '/student/courses/c1', userId: 'student-a' })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-10T12:00:00'))
})
afterEach(() => vi.useRealTimers())

describe('StudentCourseNav — Level Up "New" badge', () => {
  it('shows New until the student opens Level Up, then stays gone for them', async () => {
    const first = renderNav()
    await expectNew()
    first.unmount()

    state.pathname = '/student/courses/c1/level-up'
    const second = renderNav()
    await expectNoNew()
    expect(localStorage.getItem('level-up-redesign-seen:student-a')).toBe('1')
    second.unmount()

    state.pathname = '/student/courses/c1/quizzes'
    renderNav()
    await expectNoNew()
  })

  it('is remembered per student, so a shared computer still shows it to the next student', async () => {
    state.pathname = '/student/courses/c1/level-up'
    const a = renderNav() // student A opens Level Up
    await expectNoNew()
    expect(localStorage.getItem('level-up-redesign-seen:student-a')).toBe('1')
    a.unmount()

    state.pathname = '/student/courses/c1'
    state.userId = 'student-b'
    renderNav()
    await expectNew()
  })

  it('switches itself off after Nov 30, 2026', async () => {
    vi.setSystemTime(new Date('2026-12-01T09:00:00'))
    renderNav()
    await expectNoNew()
  })
})

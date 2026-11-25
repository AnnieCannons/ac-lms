import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/student/courses/c1' }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'student-a' } } }) },
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: () => ({ then: (cb: (r: { data: null }) => void) => cb({ data: null }) }) }
      return q
    },
  }),
}))
const taskCount = vi.fn(async () => 0)
vi.mock('@/lib/cutting-edge-actions', () => ({ getMyCuttingEdgeTaskCount: () => taskCount() }))
vi.mock('@/lib/hardware-student-actions', () => ({ getMyHardwareReturnCount: async () => 0 }))

import StudentCourseNav from '@/components/ui/StudentCourseNav'

const linkNames = () => screen.getAllByRole('link').map(l => l.textContent?.trim())

describe('StudentCourseNav in an Enrollment Readiness course', () => {
  it('shows only My Equipment, Course Outline, Grades and Profile', () => {
    render(<StudentCourseNav courseId="c1" courseName="Enrollment Readiness (2027)" enrollmentReadiness />)
    expect(linkNames()).toEqual(['My Equipment', 'Course Outline', 'Grades', 'Profile'])
    expect(taskCount).not.toHaveBeenCalled()
  })

  it('leaves every other course alone', () => {
    render(<StudentCourseNav courseId="c1" courseName="Intro to Programming" />)
    for (const name of ['General Info', 'Cutting Edge Talks', 'Class Resources', 'Career Development', 'Quizzes']) {
      expect(screen.getByRole('link', { name: new RegExp(name) })).toBeInTheDocument()
    }
  })
})

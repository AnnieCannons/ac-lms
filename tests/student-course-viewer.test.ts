import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect() throws in Next; mirror that so the helper stops where a real redirect would
class Redirect extends Error { constructor(public to: string) { super(to) } }
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Redirect(to) } }))

const state: {
  user: { id: string } | null
  role: string
  impersonation: { userId: string; studentName: string } | null
  preview: boolean
  enrollments: Record<string, string> // userId -> course role
  lastEnrollmentClient: 'rls' | 'service' | null
} = { user: null, role: 'student', impersonation: null, preview: false, enrollments: {}, lastEnrollmentClient: null }

function client(kind: 'rls' | 'service') {
  return {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => { filters[col] = val; return q },
        in: () => q,
        single: async () => ({ data: table === 'users' ? { name: 'Admin Person', role: state.role } : null }),
        maybeSingle: async () => {
          state.lastEnrollmentClient = kind
          const role = state.enrollments[filters.user_id as string]
          return { data: role ? { role } : null }
        },
      }
      return q
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => client('rls'),
  createServiceSupabaseClient: () => client('service'),
}))
vi.mock('@/lib/impersonate', () => ({ getImpersonation: async () => state.impersonation }))
vi.mock('@/lib/student-preview', () => ({ isStudentPreview: async () => state.preview }))

import { getStudentCourseViewer } from '@/lib/student-course-viewer'

const run = (opts?: { allowStaffTa?: boolean }) => getStudentCourseViewer('c1', opts)
const redirectOf = async (p: Promise<unknown>) => {
  try { await p; return null } catch (e) { if (e instanceof Redirect) return e.to; throw e }
}

beforeEach(() => {
  Object.assign(state, { user: { id: 'me' }, role: 'student', impersonation: null, preview: false, enrollments: {}, lastEnrollmentClient: null })
})

describe('getStudentCourseViewer', () => {
  it('sends logged-out visitors to login', async () => {
    state.user = null
    expect(await redirectOf(run())).toBe('/login')
  })

  it('an enrolled student sees their own data, not read-only', async () => {
    state.enrollments = { me: 'student' }
    const v = await run()
    expect(v).toMatchObject({ viewerId: 'me', readOnly: false, impersonation: null, preview: false, enrollmentRole: 'student', viewerRole: 'student' })
    expect(state.lastEnrollmentClient).toBe('rls')
  })

  it('a student not enrolled in the course goes back to their course list', async () => {
    expect(await redirectOf(run())).toBe('/student/courses')
  })

  it('staff go to the instructor view', async () => {
    state.role = 'admin'
    expect(await redirectOf(run())).toBe('/instructor/courses/c1')
  })

  it('staff who TA the course can see allowStaffTa pages as themselves', async () => {
    state.role = 'instructor'
    state.enrollments = { me: 'ta' }
    expect(await redirectOf(run())).toBe('/instructor/courses/c1')
    expect(await run({ allowStaffTa: true })).toMatchObject({ viewerId: 'me', readOnly: false })
  })

  it('an instructor previewing the course needs no enrollment', async () => {
    state.role = 'instructor'
    state.preview = true
    expect(await run()).toMatchObject({ viewerId: 'me', preview: true, readOnly: false, enrollmentRole: null })
  })

  it("an admin viewing as a student sees that student's data, read-only, through the service client", async () => {
    state.role = 'admin'
    state.impersonation = { userId: 's1', studentName: 'Lulu' }
    state.enrollments = { s1: 'student' }
    const v = await run()
    expect(v).toMatchObject({ viewerId: 's1', userId: 'me', viewerName: 'Lulu', viewerRole: 'student', readOnly: true, preview: false })
    expect(state.lastEnrollmentClient).toBe('service')
  })

  it('viewing as a student wins over a leftover preview cookie', async () => {
    state.role = 'admin'
    state.preview = true
    state.impersonation = { userId: 's1', studentName: 'Lulu' }
    state.enrollments = { s1: 'student' }
    expect(await run()).toMatchObject({ preview: false, readOnly: true, viewerId: 's1' })
  })

  it('a view-as cookie for a student outside this course lands on the instructor view', async () => {
    state.role = 'admin'
    state.impersonation = { userId: 's2', studentName: 'Sam' }
    expect(await redirectOf(run())).toBe('/instructor/courses/c1')
  })
})

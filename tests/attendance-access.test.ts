import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))

import { getAttendanceAccess, canSeeClass, filterClasses } from '@/lib/attendance-access'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

function chain(result: unknown) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return () => c
    },
  })
  return c as never
}

function setup(role: string | null, taCourseIds: string[], courses: unknown[] = []) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
  } as never)
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'users') return chain({ data: role ? { role } : null })
      if (table === 'course_enrollments') return chain({ data: taCourseIds.map(course_id => ({ course_id })) })
      return chain({ data: courses })
    },
  } as never)
}

const course = (id: string, name: string, airtable: string | null) =>
  ({ id, name, is_template: false, archived: false, airtable_course_name: airtable })

beforeEach(() => vi.clearAllMocks())

describe('getAttendanceAccess', () => {
  it.each(['instructor', 'staff', 'admin'])('a %s sees every class', async role => {
    setup(role, [])
    expect(await getAttendanceAccess()).toEqual({ allClasses: true })
  })

  it('a student who is not a TA anywhere gets nothing', async () => {
    setup('student', [])
    expect(await getAttendanceAccess()).toBeNull()
  })

  it("a TA sees only their own courses' Airtable classes, including the ITP/TCF sibling fallback", async () => {
    setup('student', ['c1', 'c3'], [
      course('c1', 'Advanced Backend (Jan 2026)', 'Backend Jan 2026'),
      course('c2', 'Advanced Frontend (Jan 2026)', 'Frontend Jan 2026'),
      // c3 has no Airtable name of its own; its same-cohort ITP/TCF sibling c4 does
      course('c3', 'The Coding Foundation (May 2026)', null),
      course('c4', 'Intro to Programming (May 2026)', 'ITP May 2026'),
    ])
    const access = await getAttendanceAccess()
    expect(access).toEqual({ allClasses: false, classNames: ['Backend Jan 2026', 'ITP May 2026'] })
    expect(filterClasses(access!, ['Backend Jan 2026', 'Frontend Jan 2026', 'ITP May 2026'])).toEqual(['Backend Jan 2026', 'ITP May 2026'])
    expect(canSeeClass(access!, 'Frontend Jan 2026')).toBe(false)
  })
})

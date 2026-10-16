import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/course-scope', () => ({ getAssignmentCourseId: vi.fn() }))

import { saveSubmission } from '@/lib/submission-actions'
import { getAssignmentCourseId } from '@/lib/course-scope'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

function chain(result: unknown, log?: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log?.push([String(prop), args]); return c }
    },
  })
  return c as never
}

function setup(tables: Record<string, unknown>) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
  } as never)
  const log: [string, unknown[]][] = []
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => chain(tables[table] ?? { data: null }, log),
  } as never)
  return log
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssignmentCourseId).mockResolvedValue('c1')
})

describe('saveSubmission', () => {
  it('rejects a student who is not enrolled in the assignment\'s course', async () => {
    setup({ course_enrollments: { data: null }, users: { data: { role: 'student' } } })
    expect(await saveSubmission('a1', 'submitted', 'x', 'text', null, null, 'America/Los_Angeles')).toEqual({ error: 'Not authorized' })
  })

  it('rejects an existing submission id that belongs to a different assignment', async () => {
    setup({
      course_enrollments: { data: { id: 'e1' } },
      users: { data: { role: 'student' } },
      assignments: { data: { due_date: '2020-01-01', is_optional: false } },
      submissions: { data: { student_id: 'me', status: 'draft', assignment_id: 'other-assignment' } },
    })
    expect(await saveSubmission('a1', 'submitted', 'x', 'text', 's1', null, 'America/Los_Angeles')).toEqual({ error: 'Not authorized' })
  })

  it('still flags a late submission when no timezone is sent', async () => {
    const log = setup({
      course_enrollments: { data: { id: 'e1' } },
      users: { data: { role: 'student' } },
      assignments: { data: { due_date: '2020-01-01', is_optional: false } },
      submissions: { data: { id: 's1' }, error: null },
    })
    await saveSubmission('a1', 'submitted', 'x', 'text', null, null, null)
    const row = log.find(([m]) => m === 'upsert')?.[1][0] as Record<string, unknown>
    expect(row.is_late).toBe(true)
  })
})

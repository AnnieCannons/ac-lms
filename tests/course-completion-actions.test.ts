import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))

import { setCourseCompleted } from '@/lib/course-completion-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

// Thenable chain: every method returns the chain; awaiting it resolves to `result`.
function chain(result: unknown, log?: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log?.push([String(prop), args]); return c }
    },
  })
  return c as never
}

function signedInAs(role: string) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    from: () => chain({ data: { role } }),
  } as never)
}

function serviceWith(result: unknown) {
  const log: [string, unknown[]][] = []
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => { log.push(['from', [table]]); return chain(result, log) },
  } as never)
  return log
}

beforeEach(() => vi.clearAllMocks())

describe('setCourseCompleted', () => {
  it.each(['student', 'ta', ''])('rejects role %j without touching the service client', async role => {
    signedInAs(role)
    expect(await setCourseCompleted('c1', 's1', true)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await setCourseCompleted('c1', 's1', false)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('refuses someone not enrolled as a student in the course', async () => {
    signedInAs('instructor')
    const log = serviceWith({ data: { role: 'observer' }, error: null })
    expect(await setCourseCompleted('c1', 's1', true)).toMatchObject({ ok: false })
    expect(log.some(([m]) => m === 'upsert')).toBe(false)
  })

  it('records who marked it for an enrolled student', async () => {
    signedInAs('staff')
    const log = serviceWith({ data: { role: 'student' }, error: null })
    expect(await setCourseCompleted('c1', 's1', true)).toEqual({ ok: true })
    const upsert = log.find(([m]) => m === 'upsert')!
    expect(upsert[1][0]).toEqual({ course_id: 'c1', user_id: 's1', marked_by: 'me' })
  })

  it('undoes a completion', async () => {
    signedInAs('admin')
    const log = serviceWith({ data: null, error: null })
    expect(await setCourseCompleted('c1', 's1', false)).toEqual({ ok: true })
    expect(log.some(([m]) => m === 'delete')).toBe(true)
  })
})

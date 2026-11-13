import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))

import { updateQuizMeta, upsertQuizFromJson, createQuizWithQuestions } from '@/lib/quiz-actions'
import { updateWiki } from '@/lib/wiki-actions'
import { createResource } from '@/lib/resource-actions'
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

function service(resultFor: (table: string) => unknown = () => ({ data: null, error: null })) {
  const log: [string, unknown[]][] = []
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => chain(resultFor(table), log),
  } as never)
  return log
}

const written = (log: [string, unknown[]][], method: string) =>
  log.find(([m]) => m === method)?.[1][0] as Record<string, unknown>

beforeEach(() => vi.clearAllMocks())

describe('quiz writes ignore smuggled columns', () => {
  it('updateQuizMeta drops course_id / linked_day_id / published', async () => {
    signedInAs('instructor')
    const log = service()
    await updateQuizMeta('q1', 'A', { title: 'T', course_id: 'B', linked_day_id: 'dB', published: true } as never)
    const patch = written(log, 'update')
    expect(patch.title).toBe('T')
    expect(patch).not.toHaveProperty('course_id')
    expect(patch).not.toHaveProperty('linked_day_id')
    expect(patch).not.toHaveProperty('published')
  })

  it('upsertQuizFromJson always writes the authorized course_id', async () => {
    signedInAs('instructor')
    const log = service(() => ({ data: { id: 'q1' }, error: null }))
    await upsertQuizFromJson('A', 'quiz-3', {
      title: 'T', due_at: null, module_title: '', published: true, questions: [], max_attempts: null, course_id: 'B',
    } as never)
    expect(written(log, 'upsert').course_id).toBe('A')
  })

  it('createQuizWithQuestions rejects a linked day from another course', async () => {
    signedInAs('instructor')
    service(table => table === 'module_days' ? { data: { module_id: 'mB' } } : { data: { course_id: 'B' } })
    await expect(createQuizWithQuestions('A', 'T', [], '', null, 'dayInB')).rejects.toThrow('Linked day is not in this course')
  })
})

describe('createResource', () => {
  it('rejects a linked day from another course', async () => {
    signedInAs('instructor')
    // Both module_days resolve to module m, whose course flips: own day → A, linked day → B.
    const courses = ['A', 'B']
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => chain(table === 'modules' ? { data: { course_id: courses.shift() } } : { data: { module_id: 'm' } }),
    } as never)
    expect(await createResource({ moduleDayId: 'dA', type: 'link', title: 'x', content: null, linkedDayId: 'dB' }))
      .toEqual({ error: 'Linked day is not in this course' })
  })
})

describe('updateWiki', () => {
  it('only writes title and content', async () => {
    signedInAs('instructor')
    const log = service(table => table === 'wikis' ? { data: { module_id: 'm', module_day_id: null }, error: null } : { data: { course_id: 'A' }, error: null })
    await updateWiki('w1', { title: 'T', content: 'C', module_id: 'mB', published: true } as never)
    expect(written(log, 'update')).toEqual({ title: 'T', content: 'C' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/student-preview', () => ({ isStudentPreview: vi.fn(async () => false) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`) }),
}))

import { submitQuiz } from '@/app/student/courses/[id]/quizzes/[quizId]/actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type Call = [string, unknown[]]

// A query chain per from(): records its calls; awaiting it resolves via resolve(table, calls).
function db(resolve: (table: string, calls: Call[]) => unknown) {
  const queries: { table: string; calls: Call[] }[] = []
  const client = {
    from(table: string) {
      const q = { table, calls: [] as Call[] }
      queries.push(q)
      const c: unknown = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(resolve(table, q.calls)).then(res)
          return (...args: unknown[]) => { q.calls.push([String(prop), args]); return c }
        },
      })
      return c
    },
  }
  return { client, queries }
}

const QUIZ = {
  id: 'q1', is_practice: true, max_attempts: null,
  questions: [{ correct_response_ident: 'a' }, { correct_response_ident: 'b' }],
}

function setup(existingSub: Record<string, unknown> | null, updatedRows: unknown[] = [{ id: 's1' }]) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'stu' } } }) },
    from: () => db(() => ({ data: { id: 'e1', role: 'student' } })).client.from('course_enrollments'),
  } as never)
  const service = db((table, calls) => {
    const has = (m: string) => calls.some(([name]) => name === m)
    if (table === 'quizzes') return { data: QUIZ, error: null }
    if (table === 'quiz_progress') return { data: has('delete') ? null : { started_at: '2026-11-02T16:00:00Z' } }
    if (has('update')) return { data: updatedRows }
    if (has('insert')) return { error: null }
    return { data: existingSub }
  })
  vi.mocked(createServiceSupabaseClient).mockReturnValue(service.client as never)
  return service.queries
}

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries({ courseId: 'c1', quizId: 'q1', ...fields })) fd.set(k, v)
  return fd
}

const writes = (queries: { table: string; calls: Call[] }[]) =>
  queries.filter(q => q.calls.some(([m]) => m === 'update' || m === 'insert' || m === 'upsert'))

beforeEach(() => vi.clearAllMocks())

describe('submitQuiz', () => {
  it('records a first attempt', async () => {
    const queries = setup(null)
    await expect(submitQuiz(form({ attemptCount: '0', answer_0: 'a', answer_1: 'x' }))).rejects.toThrow('REDIRECT')
    const [w] = writes(queries)
    const row = w.calls.find(([m]) => m === 'insert')![1][0] as Record<string, unknown>
    expect(row.attempt_count).toBe(1)
    expect(row.score_percent).toBe(50)
  })

  it('drops a second click that arrives after the first attempt saved', async () => {
    const queries = setup({ attempt_count: 1, attempt_history: [{ attempt: 1 }], answers: [] })
    await expect(submitQuiz(form({ attemptCount: '0', answer_0: 'a', answer_1: 'b' }))).rejects.toThrow('REDIRECT')
    expect(writes(queries)).toHaveLength(0)
  })

  it('only updates from the attempt count it read, and keeps progress if that lost a race', async () => {
    const queries = setup(
      { attempt_count: 1, attempt_history: [{ attempt: 1 }], answers: [{ question_index: 0, choice_ident: 'a' }, { question_index: 1, choice_ident: 'x' }] },
      [],
    )
    await expect(submitQuiz(form({ attemptCount: '1', answer_1: 'b' }))).rejects.toThrow('REDIRECT')
    const [w] = writes(queries)
    expect(w.calls).toContainEqual(['eq', ['attempt_count', 1]])
    expect(queries.some(q => q.table === 'quiz_progress' && q.calls.some(([m]) => m === 'delete'))).toBe(false)
  })

  it('merges a retake with the stored answers, not ones posted in the form', async () => {
    const queries = setup({
      attempt_count: 1,
      attempt_history: [{ attempt: 1 }],
      answers: [{ question_index: 0, choice_ident: 'x' }, { question_index: 1, choice_ident: 'b' }],
    })
    await expect(submitQuiz(form({
      attemptCount: '1',
      previousAnswers: JSON.stringify([{ question_index: 0, choice_ident: 'a' }]),
      answer_1: 'b',
    }))).rejects.toThrow('REDIRECT')
    // Question 0 wasn't retaken, so without an answer for it the stored wrong one stands
    const row = writes(queries)[0].calls.find(([m]) => m === 'update')![1][0] as Record<string, unknown>
    expect(row.score_percent).toBe(50)
    expect(row.attempt_count).toBe(2)
  })
})

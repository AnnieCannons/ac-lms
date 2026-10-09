import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/readiness-chain', () => ({ getReadinessChain: vi.fn(async (_: unknown, id: string) => [id]) }))

import {
  addReadinessNote,
  updateReadinessNote,
  deleteReadinessNote,
  getReadinessNotes,
  getMyReadinessNotes,
} from '@/lib/readiness-notes-actions'
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

function adminReturning(result: unknown, log: [string, unknown[]][] = []) {
  vi.mocked(createServiceSupabaseClient).mockReturnValue({ from: () => chain(result, log) } as never)
  return log
}

const valid = { studentId: 's1', courseId: 'c1', noteDate: '2026-10-09', body: '  Met about attendance  ', visibleToStudent: false }

describe('readiness notes actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks students and TAs (users.role student) from adding notes', async () => {
    signedInAs('student')
    const log = adminReturning({ error: null })
    expect(await addReadinessNote(valid)).toEqual({ error: expect.any(String) })
    expect(log).toHaveLength(0)
  })

  it('blocks students from reading notes', async () => {
    signedInAs('student')
    await expect(getReadinessNotes('s1', 'c1')).rejects.toThrow('Forbidden')
  })

  it('rejects an empty note or a bad date', async () => {
    signedInAs('instructor')
    adminReturning({ error: null })
    expect((await addReadinessNote({ ...valid, body: '   ' })).error).toBeTruthy()
    expect((await addReadinessNote({ ...valid, noteDate: '' })).error).toBeTruthy()
  })

  it('saves a trimmed note authored by the caller', async () => {
    signedInAs('staff')
    const log = adminReturning({ error: null })
    expect(await addReadinessNote(valid)).toEqual({})
    const insert = log.find(([m]) => m === 'insert')
    expect(insert?.[1][0]).toMatchObject({ student_id: 's1', course_id: 'c1', note_date: '2026-10-09', body: 'Met about attendance', author_id: 'me', visible_to_student: false })
  })

  it('stores the share-with-student choice', async () => {
    signedInAs('instructor')
    const log = adminReturning({ error: null })
    await addReadinessNote({ ...valid, visibleToStudent: true })
    expect(log.find(([m]) => m === 'insert')?.[1][0]).toMatchObject({ visible_to_student: true })
  })

  it('only returns shared notes to the student, read-only', async () => {
    signedInAs('student')
    const log = adminReturning({ data: [{ id: 'n1', note_date: '2026-10-09', body: 'hi', visible_to_student: true, author_id: null, created_at: '', updated_at: '' }] })
    const notes = await getMyReadinessNotes('c1')
    expect(log).toContainEqual(['eq', ['student_id', 'me']])
    expect(log).toContainEqual(['eq', ['visible_to_student', true]])
    expect(notes[0]).toMatchObject({ canEdit: false, canDelete: false })
  })

  it('only lets the author edit', async () => {
    signedInAs('instructor')
    const log = adminReturning({ data: [], error: null })
    const res = await updateReadinessNote({ id: 'n1', noteDate: '2026-10-09', body: 'x', visibleToStudent: true })
    expect(res.error).toMatch(/Only the person/)
    expect(log).toContainEqual(['eq', ['author_id', 'me']])
  })

  it('lets admins delete anyone’s note but scopes others to their own', async () => {
    signedInAs('admin')
    let log = adminReturning({ data: [{ id: 'n1' }], error: null })
    expect(await deleteReadinessNote('n1')).toEqual({})
    expect(log).not.toContainEqual(['eq', ['author_id', 'me']])

    signedInAs('instructor')
    log = adminReturning({ data: [{ id: 'n1' }], error: null })
    expect(await deleteReadinessNote('n1')).toEqual({})
    expect(log).toContainEqual(['eq', ['author_id', 'me']])
  })
})

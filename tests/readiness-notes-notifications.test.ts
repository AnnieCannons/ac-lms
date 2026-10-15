import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/readiness-chain', () => ({ getReadinessChain: vi.fn() }))

import { addReadinessNote, updateReadinessNote } from '@/lib/readiness-notes-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

// Thenable chain where every method returns the chain, so `await` works at any point.
function chain(result: unknown, log?: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log?.push([String(prop), args]); return c }
    },
  })
  return c as never
}

let notifInserts: Record<string, unknown>[]
let notifLog: [string, unknown[]][]

function setup(opts: { before?: Record<string, unknown> | null; authorName?: string | null } = {}) {
  notifInserts = []
  notifLog = []
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'staff1' } } }) },
    from: () => chain({ data: { role: 'instructor' } }),
  } as never)
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'notifications') {
        return {
          insert: (row: Record<string, unknown>) => { notifInserts.push(row); return Promise.resolve({ error: null }) },
          delete: () => { notifLog.push(['delete', []]); return chain({ error: null }, notifLog) },
        }
      }
      if (table === 'users') return chain({ data: { name: opts.authorName === undefined ? 'Catie' : opts.authorName } })
      // readiness_notes: insert → new id, the "before" select → { data: before }, update → one row updated
      return {
        insert: () => chain({ data: { id: 'note1' }, error: null }),
        select: () => chain({ data: opts.before === undefined ? null : opts.before }),
        update: () => chain({ data: [{ id: 'note1' }], error: null }),
      }
    },
  } as never)
}

const ADD = { studentId: 's1', courseId: 'c1', noteDate: '2026-10-14', body: 'Met in class.' }
const EDIT = { id: 'note1', noteDate: '2026-10-14', body: 'Met in class.' }

beforeEach(() => vi.clearAllMocks())

describe('readiness note bell notifications', () => {
  it('sends the student a bell notification, linked to the note, when a new note is shared', async () => {
    setup()
    expect(await addReadinessNote({ ...ADD, visibleToStudent: true })).toEqual({})
    expect(notifInserts).toEqual([{
      user_id: 's1',
      type: 'readiness_note_shared',
      course_id: 'c1',
      readiness_note_id: 'note1',
      message: 'Catie shared a note with you on your Weekly Readiness page.',
    }])
  })

  it('sends nothing for a staff-only note', async () => {
    setup()
    await addReadinessNote({ ...ADD, visibleToStudent: false })
    expect(notifInserts).toEqual([])
  })

  it('falls back to "Your instructor" when the author has no name', async () => {
    setup({ authorName: null })
    await addReadinessNote({ ...ADD, visibleToStudent: true })
    expect(notifInserts[0].message).toBe('Your instructor shared a note with you on your Weekly Readiness page.')
  })

  it('notifies when a staff-only note is switched to shared', async () => {
    setup({ before: { student_id: 's1', course_id: 'c1', visible_to_student: false } })
    expect(await updateReadinessNote({ ...EDIT, visibleToStudent: true })).toEqual({})
    expect(notifInserts).toHaveLength(1)
    expect(notifInserts[0]).toMatchObject({ user_id: 's1', course_id: 'c1', readiness_note_id: 'note1' })
  })

  it('does not notify again when an already-shared note is edited', async () => {
    setup({ before: { student_id: 's1', course_id: 'c1', visible_to_student: true } })
    await updateReadinessNote({ ...EDIT, visibleToStudent: true })
    expect(notifInserts).toEqual([])
    expect(notifLog).toEqual([])
  })

  it('removes the note’s notification when it is unshared', async () => {
    setup({ before: { student_id: 's1', course_id: 'c1', visible_to_student: true } })
    await updateReadinessNote({ ...EDIT, visibleToStudent: false })
    expect(notifInserts).toEqual([])
    expect(notifLog).toEqual([['delete', []], ['eq', ['readiness_note_id', 'note1']]])
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/readiness-chain', () => ({ getReadinessChain: vi.fn(async (_: unknown, id: string) => [id]) }))

import {
  addReadinessNoteReply,
  updateReadinessNoteReply,
  deleteReadinessNoteReply,
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

function signedInAs(id: string, role: string) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    from: () => chain({ data: { role } }),
  } as never)
}

const SHARED = { id: 'n1', student_id: 's1', course_id: 'c1', author_id: 'staff1', visible_to_student: true }

let replyLog: [string, unknown[]][]
let notifInserts: Record<string, unknown>[]

/** Per-table results; `replies` is what readiness_note_replies resolves to. */
function admin(tables: { note?: unknown; notes?: unknown; replies?: unknown; users?: unknown }) {
  replyLog = []
  notifInserts = []
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'notifications') {
        return { insert: (row: Record<string, unknown>) => { notifInserts.push(row); return Promise.resolve({ error: null }) } }
      }
      if (table === 'users') return chain(tables.users ?? { data: { name: 'Titeanya' } })
      if (table === 'readiness_note_replies') return chain(tables.replies ?? { data: { id: 'r1' }, error: null }, replyLog)
      return chain(tables.notes ?? { data: tables.note ?? null })
    },
  } as never)
}

beforeEach(() => vi.clearAllMocks())

describe('readiness note replies', () => {
  it('lets the student reply to a note shared with them, and bells the note’s author', async () => {
    signedInAs('s1', 'student')
    admin({ note: SHARED })
    expect(await addReadinessNoteReply({ noteId: 'n1', body: '  Thanks, I’ll be there next week.  ' })).toEqual({})
    expect(replyLog.find(([m]) => m === 'insert')?.[1][0]).toEqual({ note_id: 'n1', author_id: 's1', body: 'Thanks, I’ll be there next week.' })
    expect(notifInserts).toEqual([{
      user_id: 'staff1',
      type: 'readiness_note_student_reply',
      course_id: 'c1',
      readiness_note_id: 'n1',
      readiness_note_reply_id: 'r1',
      message: 'Titeanya replied to your note on their Weekly Readiness.',
    }])
  })

  it('bells the student when staff reply', async () => {
    signedInAs('staff2', 'instructor')
    admin({ note: SHARED, users: { data: { name: 'Catie' } } })
    expect(await addReadinessNoteReply({ noteId: 'n1', body: 'See you Friday!' })).toEqual({})
    expect(notifInserts).toEqual([expect.objectContaining({
      user_id: 's1',
      type: 'readiness_note_staff_reply',
      message: 'Catie replied to a note on your Weekly Readiness page.',
    })])
  })

  it('saves the reply but sends no bell when the note’s author no longer exists', async () => {
    signedInAs('s1', 'student')
    admin({ note: { ...SHARED, author_id: null } })
    expect(await addReadinessNoteReply({ noteId: 'n1', body: 'hi' })).toEqual({})
    expect(notifInserts).toEqual([])
  })

  it('blocks another student (including a TA) from replying', async () => {
    signedInAs('s2', 'student')
    admin({ note: SHARED })
    expect((await addReadinessNoteReply({ noteId: 'n1', body: 'hi' })).error).toBeTruthy()
    expect(replyLog.find(([m]) => m === 'insert')).toBeUndefined()
  })

  it('closes replies on a staff-only note, for staff and the student alike', async () => {
    for (const [id, role] of [['s1', 'student'], ['staff1', 'instructor']]) {
      signedInAs(id, role)
      admin({ note: { ...SHARED, visible_to_student: false } })
      expect((await addReadinessNoteReply({ noteId: 'n1', body: 'hi' })).error).toBeTruthy()
      expect(replyLog.find(([m]) => m === 'insert')).toBeUndefined()
    }
  })

  it('rejects an empty reply', async () => {
    signedInAs('s1', 'student')
    admin({ note: SHARED })
    expect((await addReadinessNoteReply({ noteId: 'n1', body: '   ' })).error).toBeTruthy()
  })

  it('only lets the author edit, and only while the note is shared', async () => {
    signedInAs('s1', 'student')
    admin({ replies: { data: null } })
    expect((await updateReadinessNoteReply({ id: 'r1', body: 'x' })).error).toMatch(/Only the person/)
    expect(replyLog).toContainEqual(['eq', ['author_id', 's1']])

    admin({ replies: { data: { id: 'r1', readiness_notes: { ...SHARED, visible_to_student: false } } } })
    expect((await updateReadinessNoteReply({ id: 'r1', body: 'x' })).error).toMatch(/isn’t shared/)
    expect(replyLog.find(([m]) => m === 'update')).toBeUndefined()
  })

  it('lets admins delete any reply but scopes everyone else to their own', async () => {
    signedInAs('a1', 'admin')
    admin({ replies: { data: [{ id: 'r1' }], error: null } })
    expect(await deleteReadinessNoteReply('r1')).toEqual({})
    expect(replyLog).not.toContainEqual(['eq', ['author_id', 'a1']])

    signedInAs('s1', 'student')
    admin({ replies: { data: [{ id: 'r1' }], error: null } })
    expect(await deleteReadinessNoteReply('r1')).toEqual({})
    expect(replyLog).toContainEqual(['eq', ['author_id', 's1']])
  })

  it('returns replies under each note with who wrote them and what the viewer can do', async () => {
    const note = { id: 'n1', note_date: '2026-10-09', body: 'hi', visible_to_student: true, author_id: 'staff1', created_at: '', updated_at: '' }
    const replies = [
      { id: 'r1', note_id: 'n1', author_id: 's1', body: 'thanks', created_at: '2026-10-10', updated_at: '2026-10-10' },
      { id: 'r2', note_id: 'n1', author_id: 'staff1', body: 'np', created_at: '2026-10-11', updated_at: '2026-10-11' },
    ]
    const users = { data: [{ id: 's1', name: 'Titeanya' }, { id: 'staff1', name: 'Catie' }] }

    signedInAs('s1', 'student')
    admin({ notes: { data: [note] }, replies: { data: replies }, users })
    const [mine] = await getMyReadinessNotes('c1')
    expect(mine.canReply).toBe(true)
    expect(mine.replies).toEqual([
      expect.objectContaining({ id: 'r1', authorName: 'Titeanya', fromStudent: true, mine: true, canEdit: true, canDelete: true }),
      expect.objectContaining({ id: 'r2', authorName: 'Catie', fromStudent: false, mine: false, canEdit: false, canDelete: false }),
    ])

    signedInAs('a1', 'admin')
    admin({ notes: { data: [{ ...note, visible_to_student: false }] }, replies: { data: replies }, users })
    const [staffView] = await getReadinessNotes('s1', 'c1')
    expect(staffView.canReply).toBe(false)
    expect(staffView.replies.map(r => [r.canEdit, r.canDelete])).toEqual([[false, true], [false, true]])
  })
})

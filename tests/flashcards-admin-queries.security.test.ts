import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/flashcards/queries', () => ({ getIsFlashcardAdmin: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getStudentActivity, getMostStudiedDecks, getAllImportActivity, getImportActivity } from '@/lib/flashcards/admin-queries'
import { importDeck } from '@/lib/flashcards/actions'
import { getIsFlashcardAdmin } from '@/lib/flashcards/queries'
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

function signedIn(id: string | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: id ? { id } : null } }) },
    from: () => chain({ data: null }),
  } as never)
}

beforeEach(() => vi.clearAllMocks())

describe('flashcard admin queries', () => {
  it('reject a non-admin caller before touching the service client', async () => {
    signedIn('student')
    vi.mocked(getIsFlashcardAdmin).mockResolvedValue(false)
    await expect(getStudentActivity('c1', '2000-01-01', '2100-01-01')).rejects.toThrow('Forbidden')
    await expect(getMostStudiedDecks('c1', '2000-01-01', '2100-01-01')).rejects.toThrow('Forbidden')
    await expect(getImportActivity('d1')).rejects.toThrow('Forbidden')
    await expect(getAllImportActivity('student')).rejects.toThrow('Forbidden')
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('reject an anonymous caller', async () => {
    signedIn(null)
    await expect(getStudentActivity('c1', '2000-01-01', '2100-01-01')).rejects.toThrow('Forbidden')
  })

  it("won't show another user's import activity, even to an admin", async () => {
    signedIn('admin1')
    vi.mocked(getIsFlashcardAdmin).mockResolvedValue(true)
    await expect(getAllImportActivity('someone-else')).rejects.toThrow('Forbidden')
  })
})

describe('importDeck', () => {
  it("refuses to copy someone else's private deck", async () => {
    signedIn('me')
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => chain(table === 'decks'
        ? { data: { id: 'd1', owner_user_id: 'other', is_shared: false, title: 'Private' } }
        : { data: [] }),
    } as never)
    await expect(importDeck('d1')).rejects.toThrow('Source deck not found')
  })
})

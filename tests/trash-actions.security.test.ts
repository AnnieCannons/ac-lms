import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))

import { emptyTrash, permanentlyDeleteItem } from '@/lib/trash-actions'
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

beforeEach(() => vi.clearAllMocks())

describe('irreversible trash actions', () => {
  it('a TA of the course cannot empty the trash or permanently delete', async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'ta1' } } }) },
      // users.role → student; a TA enrollment would also be found if it were asked for
      from: (table: string) => chain(table === 'users' ? { data: { role: 'student' } } : { data: { role: 'ta' } }),
    } as never)
    expect(await emptyTrash('c1')).toEqual({ error: 'Not authorized' })
    expect(await permanentlyDeleteItem('assignment', 'a1', 'c1')).toEqual({ error: 'Not authorized' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })
})

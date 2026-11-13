import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))

import { pickFields } from '@/lib/pick-fields'
import { updateContact } from '@/lib/partner-actions'
import { updateReferral } from '@/lib/partner-interactions-actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function staffClient(log: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve({ data: { role: 'staff' }, error: null }).then(res)
      return (...args: unknown[]) => { log.push([String(prop), args]); return c }
    },
  })
  return { auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) }, from: () => c }
}

beforeEach(() => vi.clearAllMocks())

describe('pickFields', () => {
  it('keeps only listed keys that are present', () => {
    expect(pickFields({ a: 1, b: 2, c: 3 } as Record<string, number>, ['a', 'c', 'd'])).toEqual({ a: 1, c: 3 })
  })
})

describe('partnerships save actions drop unexpected columns', () => {
  it('updateContact cannot move a contact to another partner', async () => {
    const log: [string, unknown[]][] = []
    vi.mocked(createServerSupabaseClient).mockResolvedValue(staffClient(log) as never)
    await updateContact('ct1', { name: 'New', partner_id: 'other' } as never)
    expect(log).toContainEqual(['update', [{ name: 'New' }]])
  })

  it('updateReferral cannot rewrite logged_by', async () => {
    const log: [string, unknown[]][] = []
    vi.mocked(createServerSupabaseClient).mockResolvedValue(staffClient(log) as never)
    await updateReferral('r1', { outcome_notes: 'ok', logged_by: 'someone' } as never)
    expect(log).toContainEqual(['update', [{ outcome_notes: 'ok' }]])
  })
})

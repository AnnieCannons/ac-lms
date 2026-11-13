import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/slack', () => ({ notifyStaff: vi.fn(), slackEscape: (s: string) => s }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createRating } from '@/lib/partner-ratings-actions'
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

function student(tables: Record<string, unknown>) {
  const log: [string, unknown[]][] = []
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    from: (t: string) => chain(t === 'users' ? { data: { role: 'student' } } : (tables[t] ?? { data: null, error: null }), log),
  } as never)
  vi.mocked(createServiceSupabaseClient).mockReturnValue({ from: () => chain({ data: null }) } as never)
  return log
}

const base = { partner_id: 'any-partner', service_category: 'Housing', score: 5, reviewer_type: 'student' as const }

beforeEach(() => vi.clearAllMocks())

describe('createRating (student)', () => {
  it('requires a referral', async () => {
    student({})
    expect(await createRating({ ...base, referral_id: null })).toEqual({ error: 'Not authorized' })
  })

  it("rejects someone else's referral", async () => {
    student({ student_referrals: { data: { student_user_id: 'other', partner_id: 'p1' } } })
    expect(await createRating({ ...base, referral_id: 'r1' })).toEqual({ error: 'Not authorized' })
  })

  it("rates the referral's partner, not the client-supplied one", async () => {
    const log = student({ student_referrals: { data: { student_user_id: 'me', partner_id: 'p1' } } })
    await createRating({ ...base, referral_id: 'r1' })
    const row = log.find(([m]) => m === 'insert')?.[1][0] as Record<string, unknown>
    expect(row.partner_id).toBe('p1')
  })
})

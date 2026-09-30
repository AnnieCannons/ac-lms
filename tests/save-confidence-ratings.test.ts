import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/feature-flags', () => ({ isConfidenceRatingsEnabled: vi.fn() }))
vi.mock('@/lib/skill-actions', () => ({ listAssignmentSkills: vi.fn() }))

import { saveConfidenceRatings } from '@/lib/confidence-tracker-actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'

interface Opts {
  existing?: { id: string }[]
  priorRows?: { id: string; skill_id: string; rating: number; created_at: string }[]
  priorError?: { message: string } | null
  insertError?: { message: string } | null
  progress?: Record<string, unknown>[]
}

// Per-table stand-in for the Supabase query builder used by saveConfidenceRatings. Every
// chain is thenable so `await` works at any point, and `calls` records the order of the
// ratings reads/writes so we can assert the prior-rating read happens before the insert.
function makeClient(opts: Opts = {}) {
  const calls: string[] = []
  const upsert = vi.fn(async () => ({ error: null }))
  let ratingsSelects = 0
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      if (table === 'confidence_tracker_ratings') {
        return {
          select: () => {
            const which = ++ratingsSelects === 1 ? 'existing' : 'prior'
            calls.push(`select:${which}`)
            const result =
              which === 'existing'
                ? { data: opts.existing ?? [], error: null }
                : { data: opts.priorRows ?? [], error: opts.priorError ?? null }
            const chain: Record<string, unknown> = {}
            chain.eq = () => chain
            chain.in = () => chain
            chain.order = () => chain
            chain.limit = () => chain
            chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
            return chain
          },
          insert: async () => {
            calls.push('insert')
            return { error: opts.insertError ?? null }
          },
        }
      }
      if (table === 'confidence_tracker_assignment_skills') {
        return { select: () => ({ eq: async () => ({ data: [{ skill_id: 's1' }], error: null }) }) }
      }
      if (table === 'confidence_tracker_skill_progress') {
        return {
          select: () => ({ eq: () => ({ in: async () => ({ data: opts.progress ?? [], error: null }) }) }),
          upsert,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)
  return { calls, upsert }
}

const established = {
  skill_id: 's1', is_new_pending: false, goal: null, goal_is_maintain: false, target_date: null,
  study_plan: null, study_plan_other: null, ten_rating_count: 0, is_mastered: false, mastered_at: null,
}
const prior = (rating: number) => [{ id: 'r1', skill_id: 's1', rating, created_at: '2026-01-01T00:00:00Z' }]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(true)
})

describe('saveConfidenceRatings kudos', () => {
  it('returns kudos on an increase over the most recent earlier rating', async () => {
    makeClient({ priorRows: prior(4), progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(result).toEqual({ error: null, kudos: [{ skillId: 's1', from: 4, to: 6 }] })
  })

  it('reads earlier ratings before inserting the new ones', async () => {
    const { calls } = makeClient({ priorRows: prior(4), progress: [established] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(calls.indexOf('select:prior')).toBeGreaterThan(-1)
    expect(calls.indexOf('select:prior')).toBeLessThan(calls.indexOf('insert'))
  })

  it('returns no kudos for an equal rating or without an earlier one', async () => {
    makeClient({ priorRows: prior(6), progress: [established] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])).kudos).toEqual([])
    makeClient({ priorRows: [], progress: [established] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])).kudos).toEqual([])
  })

  it('returns no kudos for the first rating after a reactivation', async () => {
    makeClient({ priorRows: prior(2), progress: [{ ...established, is_new_pending: true }] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 8 }])).kudos).toEqual([])
  })

  it('still saves and returns no kudos when the earlier-ratings read fails', async () => {
    const { upsert } = makeClient({ priorError: { message: 'boom' }, progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(result).toEqual({ error: null, kudos: [] })
    expect(upsert).toHaveBeenCalled()
  })

  it('returns the error and no kudos when the insert fails', async () => {
    makeClient({ priorRows: prior(4), progress: [established], insertError: { message: 'nope' } })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(result.error).toBe('nope')
    expect(result.kudos).toBeUndefined()
  })

  it('returns no kudos on a repeat call for an already-rated assignment', async () => {
    const { calls } = makeClient({ existing: [{ id: 'x' }], priorRows: prior(4), progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(result).toEqual({ error: null })
    expect(calls).not.toContain('insert')
  })

  it('withholds kudos when the flag is off but still saves the ratings', async () => {
    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const { calls } = makeClient({ priorRows: prior(4), progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(result).toEqual({ error: null, kudos: [] })
    expect(calls).toContain('insert')
  })
})

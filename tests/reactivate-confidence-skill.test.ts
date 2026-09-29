import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/feature-flags', () => ({ isConfidenceRatingsEnabled: vi.fn() }))

import { reactivateConfidenceSkill } from '@/lib/confidence-trend-actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'

// Minimal chainable stand-in for the Supabase query builder used by the action.
function makeClient({ user = { id: 'u1' } as { id: string } | null, role = 'student', updated = [{ id: 'p1' }] as { id: string }[] | null, updateError = null as unknown } = {}) {
  const update = vi.fn()
  const eqs: [string, unknown][] = []
  const updateChain: Record<string, unknown> = {}
  updateChain.eq = (col: string, val: unknown) => { eqs.push([col, val]); return updateChain }
  updateChain.select = () => Promise.resolve({ data: updated, error: updateError })
  update.mockReturnValue(updateChain)

  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table === 'users') return { select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) }
      return { update }
    },
  }
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)
  return { update, eqs }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(true)
})

describe('reactivateConfidenceSkill', () => {
  it('is rejected when the feature flag is off, without touching the database', async () => {
    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const { update } = makeClient()
    const result = await reactivateConfidenceSkill('s1')
    expect(result.error).toMatch(/not available/)
    expect(update).not.toHaveBeenCalled()
  })

  it('is rejected for an unauthenticated caller', async () => {
    const { update } = makeClient({ user: null })
    expect((await reactivateConfidenceSkill('s1')).error).toMatch(/logged in/)
    expect(update).not.toHaveBeenCalled()
  })

  it.each(['staff', 'instructor', 'admin'])('is rejected for %s (preview) accounts', async role => {
    const { update } = makeClient({ role })
    expect((await reactivateConfidenceSkill('s1')).error).toMatch(/Staff cannot/)
    expect(update).not.toHaveBeenCalled()
  })

  it('resets mastery and clears the goal in one update, scoped to the caller\'s own mastered row', async () => {
    const { update, eqs } = makeClient()
    expect(await reactivateConfidenceSkill('s1')).toEqual({ error: null })
    expect(update).toHaveBeenCalledTimes(1)
    const payload = update.mock.calls[0][0]
    expect(payload).toMatchObject({
      is_mastered: false, ten_rating_count: 0, is_new_pending: true,
      goal: null, goal_is_maintain: false, target_date: null, study_plan: null, study_plan_other: null,
    })
    expect(typeof payload.reactivated_at).toBe('string')
    expect(payload).not.toHaveProperty('mastered_at') // the earlier mastery date is left in place
    expect(eqs).toEqual([['student_id', 'u1'], ['skill_id', 's1'], ['is_mastered', true]])
  })

  it('changes nothing and reports it when the skill is not mastered (or is someone else\'s)', async () => {
    makeClient({ updated: [] })
    expect((await reactivateConfidenceSkill('s1')).error).toMatch(/not mastered/)
  })

  it('treats a repeat call as a harmless no-op', async () => {
    makeClient({ updated: [{ id: 'p1' }] })
    expect((await reactivateConfidenceSkill('s1')).error).toBeNull()
    makeClient({ updated: [] })
    expect((await reactivateConfidenceSkill('s1')).error).toMatch(/not mastered/)
  })

  it('returns a non-blaming error when the update fails', async () => {
    makeClient({ updated: null, updateError: { message: 'boom' } })
    expect((await reactivateConfidenceSkill('s1')).error).toMatch(/Please try again/)
  })
})

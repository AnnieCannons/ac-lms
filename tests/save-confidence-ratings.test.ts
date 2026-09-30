import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/feature-flags', () => ({ isConfidenceRatingsEnabled: vi.fn() }))
vi.mock('@/lib/skill-actions', () => ({ listAssignmentSkills: vi.fn() }))

import { saveConfidenceRatings } from '@/lib/confidence-tracker-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'

interface Opts {
  existing?: { id: string }[]
  priorRows?: { id: string; skill_id: string; rating: number; created_at: string }[]
  priorError?: { message: string } | null
  insertError?: { message: string } | null
  progress?: Record<string, unknown>[]
  goalRows?: Record<string, unknown>[]
  outcomeRows?: { goal_history_id: string }[]
  outcomeInsertError?: { message: string } | null
  notificationInsertError?: { message: string } | null
}

// Per-table stand-in for the Supabase query builder used by saveConfidenceRatings. Every
// chain is thenable so `await` works at any point, and `calls` records the order of the
// ratings reads/writes so we can assert the prior-rating read happens before the insert.
function makeClient(opts: Opts = {}) {
  const calls: string[] = []
  const upsert = vi.fn(async () => ({ error: null }))
  const outcomeUpsert = vi.fn()
  const outcomeUpdate = vi.fn()
  const notificationInsert = vi.fn()
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
      if (table === 'confidence_tracker_goal_history') {
        return {
          select: () => {
            const chain: Record<string, unknown> = {}
            chain.eq = () => chain
            chain.in = () => chain
            chain.order = () => chain
            chain.then = (res: (v: unknown) => unknown) =>
              Promise.resolve({ data: opts.goalRows ?? [], error: null }).then(res)
            return chain
          },
        }
      }
      if (table === 'confidence_tracker_goal_outcomes') {
        return { select: () => ({ in: async () => ({ data: opts.outcomeRows ?? [], error: null }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)

  // The goal-met outcome is written with the service-role client (the table has no write policies).
  outcomeUpsert.mockImplementation((rows: { goal_history_id: string }[]) => ({
    select: async () =>
      opts.outcomeInsertError
        ? { data: null, error: opts.outcomeInsertError }
        : { data: rows.map((row, i) => ({ id: `o${i + 1}`, goal_history_id: row.goal_history_id })), error: null },
  }))
  const service = {
    from: (table: string) => {
      if (table === 'confidence_tracker_goal_outcomes') {
        return {
          upsert: outcomeUpsert,
          update: (payload: unknown) => {
            const c: Record<string, unknown> = {}
            c.eq = (col: string, val: unknown) => { outcomeUpdate(payload, col, val); return Promise.resolve({ error: null }) }
            return c
          },
        }
      }
      if (table === 'confidence_tracker_skills') {
        return { select: () => ({ in: async () => ({ data: [{ id: 's1', name: 'React' }], error: null }) }) }
      }
      if (table === 'notifications') {
        return {
          insert: (row: unknown) => {
            notificationInsert(row)
            return { select: () => ({ single: async () => (opts.notificationInsertError ? { data: null, error: opts.notificationInsertError } : { data: { id: 'n1' }, error: null }) }) }
          },
        }
      }
      throw new Error(`unexpected service table ${table}`)
    },
  }
  vi.mocked(createServiceSupabaseClient).mockReturnValue(service as never)
  return { calls, upsert, outcomeUpsert, outcomeUpdate, notificationInsert }
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
    expect(result).toEqual({ error: null, kudos: [{ skillId: 's1', from: 4, to: 6 }], celebrations: [] })
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
    expect(result).toEqual({ error: null, kudos: [], celebrations: [] })
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
    expect(result).toEqual({ error: null, kudos: [], celebrations: [] })
    expect(calls).toContain('insert')
  })
})

describe('saveConfidenceRatings goal-met and mastery celebrations', () => {
  const withGoal = { ...established, goal: 7, target_date: '2026-11-01', study_plan: ['flashcards'] }
  const goalRow = (over: Record<string, unknown> = {}) => ({
    id: 'g1', skill_id: 's1', goal: 7, goal_is_maintain: false, study_plan: ['flashcards'], study_plan_other: null, ...over,
  })

  it('records one outcome and celebrates when a rating reaches the goal, replacing that skill\'s kudos', async () => {
    const { outcomeUpsert } = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow()] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(result.celebrations).toEqual([
      { skillId: 's1', rating: 7, mastered: false, goal: { outcomeId: 'o1', target: 7, ownPlanText: null, nextGoalAllowed: true } },
    ])
    expect(result.kudos).toEqual([])
    expect(outcomeUpsert).toHaveBeenCalledTimes(1)
    const [rows, options] = outcomeUpsert.mock.calls[0] as unknown as [Record<string, unknown>[], Record<string, unknown>]
    expect(rows[0]).toMatchObject({
      goal_history_id: 'g1', student_id: 'u1', skill_id: 's1', met_rating: 7,
      met_assignment_id: 'a1',
    })
    expect(rows[0]).not.toHaveProperty('student_timezone')
    expect(options).toMatchObject({ onConflict: 'goal_history_id', ignoreDuplicates: true })
  })

  it('offers the student\'s own study-plan write-in as a "what helped" choice', async () => {
    makeClient({
      priorRows: prior(4), progress: [withGoal],
      goalRows: [goalRow({ study_plan: ['other'], study_plan_other: 'Pair with a friend' })],
    })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 8 }])
    expect(result.celebrations?.[0].goal?.ownPlanText).toBe('Pair with a friend')
  })

  it('keeps ordinary kudos when the rating improved but the goal was not reached', async () => {
    const { outcomeUpsert } = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow()] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])
    expect(result.celebrations).toEqual([])
    expect(result.kudos).toEqual([{ skillId: 's1', from: 4, to: 6 }])
    expect(outcomeUpsert).not.toHaveBeenCalled()
  })

  it('does not celebrate a goal that was already met, a maintaining goal, or a skill with no goal', async () => {
    makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow()], outcomeRows: [{ goal_history_id: 'g1' }] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 9 }])).celebrations).toEqual([])
    makeClient({ priorRows: prior(4), progress: [{ ...established, goal_is_maintain: true }], goalRows: [goalRow({ goal: null, goal_is_maintain: true })] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 9 }])).celebrations).toEqual([])
    makeClient({ priorRows: prior(4), progress: [established], goalRows: [] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 9 }])).celebrations).toEqual([])
  })

  it('celebrates mastery on the second 10 without recording an outcome', async () => {
    const { outcomeUpsert } = makeClient({ priorRows: prior(10), progress: [{ ...established, ten_rating_count: 1 }] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([{ skillId: 's1', rating: 10, mastered: true }])
    expect(outcomeUpsert).not.toHaveBeenCalled()
  })

  it('does not celebrate a first 10 that meets no goal', async () => {
    makeClient({ priorRows: prior(7), progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([])
    expect(result.kudos).toEqual([{ skillId: 's1', from: 7, to: 10 }])
  })

  it('gives one combined celebration, with the question for the goal and no next goal, when a 10 meets a goal of 10 and completes mastery', async () => {
    makeClient({
      priorRows: prior(10), goalRows: [goalRow({ goal: 10 })],
      progress: [{ ...established, goal: 10, target_date: '2026-11-01', study_plan: ['flashcards'], ten_rating_count: 1 }],
    })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([
      { skillId: 's1', rating: 10, mastered: true, goal: { outcomeId: 'o1', target: 10, ownPlanText: null, nextGoalAllowed: false } },
    ])
  })

  it('still saves and shows kudos (no celebration) when recording the outcome fails', async () => {
    const { upsert } = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow()], outcomeInsertError: { message: 'nope' } })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(result.error).toBeNull()
    expect(result.celebrations).toEqual([])
    expect(result.kudos).toEqual([{ skillId: 's1', from: 4, to: 7 }])
    expect(upsert).toHaveBeenCalled()
  })

  it('records no outcome and celebrates nothing with the flag off, but still saves the ratings', async () => {
    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const { calls, outcomeUpsert } = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow()] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(result).toEqual({ error: null, kudos: [], celebrations: [] })
    expect(calls).toContain('insert')
    expect(outcomeUpsert).not.toHaveBeenCalled()
  })

  it('celebrates nothing on a repeat call for an already-rated assignment', async () => {
    const { outcomeUpsert } = makeClient({ existing: [{ id: 'x' }], progress: [withGoal], goalRows: [goalRow()] })
    expect(await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 9 }])).toEqual({ error: null })
    expect(outcomeUpsert).not.toHaveBeenCalled()
  })
})

describe('saveConfidenceRatings goal-met reminder in the bell', () => {
  const withGoal = { skill_id: 's1', is_new_pending: false, goal: 7, goal_is_maintain: false, target_date: '2026-11-01', study_plan: ['flashcards'], study_plan_other: null, ten_rating_count: 0, is_mastered: false, mastered_at: null }
  const goalRow = { id: 'g1', skill_id: 's1', goal: 7, goal_is_maintain: false, study_plan: ['flashcards'], study_plan_other: null }

  it('puts the reminder in the bell right away and links it to the met goal', async () => {
    const { notificationInsert, outcomeUpdate } = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(notificationInsert).toHaveBeenCalledTimes(1)
    expect(notificationInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'confidence_goal_what_helped',
      message: 'You reached your goal of 7 in React. Log what helped.',
    })
    // no course/assignment ids (the bell would link to an assignment), and no emailed_at (bell only)
    expect(notificationInsert.mock.calls[0][0]).not.toHaveProperty('assignment_id')
    expect(outcomeUpdate).toHaveBeenCalledWith({ reminder_notification_id: 'n1' }, 'id', 'o1')
  })

  it('still celebrates if the reminder cannot be created', async () => {
    makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow], notificationInsertError: { message: 'nope' } })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(result.celebrations).toHaveLength(1)
  })

  it('creates no reminder for mastery (nothing to log), for a goal already met, or with the flag off', async () => {
    const mastery = makeClient({ priorRows: prior(10), progress: [{ ...withGoal, goal: null, target_date: null, study_plan: null, ten_rating_count: 1 }] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(mastery.notificationInsert).not.toHaveBeenCalled()

    const already = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow], outcomeRows: [{ goal_history_id: 'g1' }] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 9 }])
    expect(already.notificationInsert).not.toHaveBeenCalled()

    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const off = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(off.notificationInsert).not.toHaveBeenCalled()
  })
})

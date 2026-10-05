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
  const upsert = vi.fn(async (..._args: unknown[]) => ({ error: null }))
  const outcomeUpsert = vi.fn()
  const outcomeInsert = vi.fn()
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
          insert: (rows: { skill_id: string }[]) => {
            outcomeInsert(rows)
            return { select: async () => ({ data: rows.map((r, i) => ({ id: `r${i + 1}`, skill_id: r.skill_id })), error: null }) }
          },
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
  return { calls, upsert, outcomeUpsert, outcomeInsert, outcomeUpdate, notificationInsert }
}

const established = {
  skill_id: 's1', goal: null, goal_is_maintain: false, target_date: null, study_plan: null, study_plan_other: null,
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

  it('gives kudos for a rise of just +1, with no dependence on the progress row', async () => {
    makeClient({ priorRows: prior(5), progress: [] })
    expect((await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6 }])).kudos).toEqual([{ skillId: 's1', from: 5, to: 6 }])
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

describe('saveConfidenceRatings goal-met and 10 celebrations', () => {
  const withGoal = { ...established, goal: 7, target_date: '2026-11-01', study_plan: ['flashcards'] }
  const goalRow = (over: Record<string, unknown> = {}) => ({
    id: 'g1', skill_id: 's1', goal: 7, goal_is_maintain: false, study_plan: ['flashcards'], study_plan_other: null, ...over,
  })

  it('records one outcome and celebrates when a rating reaches the goal, replacing that skill\'s kudos', async () => {
    const { outcomeUpsert } = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow()] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(result.celebrations).toEqual([
      { skillId: 's1', rating: 7, kind: 'goal', goal: { outcomeId: 'o1', target: 7, ownPlanText: null, nextGoalAllowed: true } },
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

  it('celebrates a met goal of 10 with the goal question and no next goal', async () => {
    makeClient({
      priorRows: prior(8), goalRows: [goalRow({ goal: 10 })],
      progress: [{ ...established, goal: 10, target_date: '2026-11-01', study_plan: ['flashcards'] }],
    })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([
      { skillId: 's1', rating: 10, kind: 'goal', goal: { outcomeId: 'o1', target: 10, ownPlanText: null, nextGoalAllowed: false } },
    ])
    expect(result.kudos).toEqual([])
  })

  it('records a standalone outcome and celebrates a return to 10 with no goal, replacing the kudos', async () => {
    const { outcomeInsert, outcomeUpsert } = makeClient({ priorRows: prior(7), progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([
      { skillId: 's1', rating: 10, kind: 'returned', goal: { outcomeId: 'r1', target: null, ownPlanText: null, nextGoalAllowed: false } },
    ])
    expect(result.kudos).toEqual([])
    expect(outcomeUpsert).not.toHaveBeenCalled()
    expect(outcomeInsert).toHaveBeenCalledTimes(1)
    expect(outcomeInsert.mock.calls[0][0][0]).toMatchObject({
      goal_history_id: null, student_id: 'u1', skill_id: 's1', met_rating: 10, met_assignment_id: 'a1',
    })
  })

  it('gives a first-ever 10 a short celebration with no outcome and no reminder', async () => {
    const { outcomeInsert, outcomeUpsert, notificationInsert } = makeClient({ priorRows: [], progress: [] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([{ skillId: 's1', rating: 10, kind: 'first' }])
    expect(result.kudos).toEqual([])
    expect(outcomeInsert).not.toHaveBeenCalled()
    expect(outcomeUpsert).not.toHaveBeenCalled()
    expect(notificationInsert).not.toHaveBeenCalled()
  })

  it('saves an explicit 10 on a skill already at 10 with no kudos and no celebration', async () => {
    const { calls, outcomeInsert, notificationInsert } = makeClient({ priorRows: prior(10), progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result).toEqual({ error: null, kudos: [], celebrations: [] })
    expect(calls).toContain('insert')
    expect(outcomeInsert).not.toHaveBeenCalled()
    expect(notificationInsert).not.toHaveBeenCalled()
  })

  it('has no mastery behavior: repeated 10s never produce a mastered celebration', async () => {
    makeClient({ priorRows: [...prior(10), { id: 'r0', skill_id: 's1', rating: 10, created_at: '2025-12-01T00:00:00Z' }], progress: [established] })
    const result = await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(result.celebrations).toEqual([])
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
  const withGoal = { skill_id: 's1', goal: 7, goal_is_maintain: false, target_date: '2026-11-01', study_plan: ['flashcards'], study_plan_other: null }
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

  it('puts a "back at 10" reminder in the bell for a return to 10 with no goal, linked to its outcome', async () => {
    const { notificationInsert, outcomeUpdate } = makeClient({ priorRows: prior(7), progress: [{ ...withGoal, goal: null, target_date: null, study_plan: null }] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(notificationInsert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'confidence_goal_what_helped',
      message: "You're back at 10 in React. Log what helped.",
    })
    expect(outcomeUpdate).toHaveBeenCalledWith({ reminder_notification_id: 'n1' }, 'id', 'r1')
  })

  it('creates no reminder for a first-ever 10, for a goal already met, or with the flag off', async () => {
    const first = makeClient({ priorRows: [], progress: [] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10 }])
    expect(first.notificationInsert).not.toHaveBeenCalled()

    const already = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow], outcomeRows: [{ goal_history_id: 'g1' }] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 9 }])
    expect(already.notificationInsert).not.toHaveBeenCalled()

    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const off = makeClient({ priorRows: prior(4), progress: [withGoal], goalRows: [goalRow] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 7 }])
    expect(off.notificationInsert).not.toHaveBeenCalled()
  })
})

describe('saveConfidenceRatings goals', () => {
  const newGoal = { goal: 8, targetDate: '2999-01-01', studyPlan: ['flashcards' as const] }

  it('a new goal after a dip replaces an old maintain marker (goal_is_maintain false in the upsert)', async () => {
    const { upsert } = makeClient({ priorRows: prior(10), progress: [{ ...established, goal_is_maintain: true }] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 6, goal: newGoal }])
    const [rows] = upsert.mock.calls[0] as unknown as [Record<string, unknown>[]]
    expect(rows[0]).toMatchObject({ goal: 8, goal_is_maintain: false, target_date: '2999-01-01', study_plan: ['flashcards'] })
    expect(rows[0]).not.toHaveProperty('ten_rating_count')
    expect(rows[0]).not.toHaveProperty('is_mastered')
  })

  it('never overwrites a goal still open, and accepts no goal at a rating of 10', async () => {
    const open = { ...established, goal: 7, target_date: '2026-11-01', study_plan: ['flashcards'] }
    const a = makeClient({ priorRows: prior(4), progress: [open], goalRows: [{ id: 'g1', skill_id: 's1', goal: 7, goal_is_maintain: false, study_plan: ['flashcards'], study_plan_other: null }] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 5, goal: newGoal }])
    expect((a.upsert.mock.calls[0] as unknown as [Record<string, unknown>[]])[0][0]).toMatchObject({ goal: 7 })

    const b = makeClient({ priorRows: prior(10), progress: [established] })
    await saveConfidenceRatings('a1', [{ skillId: 's1', rating: 10, goal: newGoal }])
    expect((b.upsert.mock.calls[0] as unknown as [Record<string, unknown>[]])[0][0]).toMatchObject({ goal: null })
  })
})

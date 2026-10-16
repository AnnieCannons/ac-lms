import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/feature-flags', () => ({ isConfidenceRatingsEnabled: vi.fn() }))

import { answerWhatHelped, setSkillGoal } from '@/lib/goal-met-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'

// Thenable chain where every method returns the chain, so `await` works at any point and
// maybeSingle()/single()/select() all resolve to the same stubbed result.
function chain(result: unknown, log?: [string, unknown[]][]) {
  const c: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
        return (...args: unknown[]) => {
          log?.push([String(prop), args])
          return c
        }
      },
    }
  )
  return c as never
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(true)
})

// ─── answerWhatHelped ──────────────────────────────────────────────────────────────────────

interface AnswerOpts {
  user?: { id: string } | null
  role?: string
  outcome?: Record<string, unknown> | null
  goalRow?: Record<string, unknown> | null
  updated?: { id: string }[]
  updateError?: { message: string } | null
}

function answerSetup(opts: AnswerOpts = {}) {
  const { user = { id: 'u1' }, role = 'student' } = opts
  const outcome = opts.outcome === undefined
    ? { id: 'o1', goal_history_id: 'g1', answered_at: null, reminder_notification_id: null }
    : opts.outcome
  const outcomeUpdate = vi.fn()
  const outcomeEqs: [string, unknown][] = []
  const notifUpdate = vi.fn()
  const notifEqs: [string, unknown][] = []

  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => chain({ data: { role } }),
  } as never)

  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'confidence_tracker_goal_outcomes') {
        return {
          select: () => chain({ data: outcome }),
          update: (payload: unknown) => {
            outcomeUpdate(payload)
            const c: Record<string, unknown> = {}
            c.eq = (col: string, val: unknown) => { outcomeEqs.push([col, val]); return c }
            c.is = (col: string, val: unknown) => { outcomeEqs.push([`is:${col}`, val]); return c }
            c.select = () => Promise.resolve({ data: opts.updated ?? [{ id: 'o1' }], error: opts.updateError ?? null })
            return c
          },
        }
      }
      if (table === 'confidence_tracker_goal_history') {
        return { select: () => chain({ data: opts.goalRow ?? { study_plan: ['flashcards'], study_plan_other: null } }) }
      }
      if (table === 'notifications') {
        return {
          update: (payload: unknown) => {
            notifUpdate(payload)
            const c: Record<string, unknown> = {}
            c.eq = (col: string, val: unknown) => { notifEqs.push([col, val]); return c.eq ? { ...c, then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r) } : c }
            return c
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as never)
  return { outcomeUpdate, outcomeEqs, notifUpdate, notifEqs }
}

describe('answerWhatHelped', () => {
  it('is rejected when the flag is off, unauthenticated, or for staff, without writing', async () => {
    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const off = answerSetup()
    expect((await answerWhatHelped('o1', ['flashcards'])).error).toMatch(/not available/)
    expect(off.outcomeUpdate).not.toHaveBeenCalled()

    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(true)
    const anon = answerSetup({ user: null })
    expect((await answerWhatHelped('o1', ['flashcards'])).error).toMatch(/logged in/)
    expect(anon.outcomeUpdate).not.toHaveBeenCalled()

    for (const role of ['staff', 'instructor', 'admin']) {
      const staff = answerSetup({ role })
      expect((await answerWhatHelped('o1', ['flashcards'])).error).toMatch(/Staff cannot/)
      expect(staff.outcomeUpdate).not.toHaveBeenCalled()
    }
  })

  it('cannot answer a goal that is not the caller\'s own', async () => {
    const s = answerSetup({ outcome: null })
    expect((await answerWhatHelped('someone-elses', ['flashcards'])).error).toMatch(/couldn't find/)
    expect(s.outcomeUpdate).not.toHaveBeenCalled()
  })

  it('saves the options once, scoped to the caller and only while still unanswered', async () => {
    const s = answerSetup()
    expect(await answerWhatHelped('o1', ['flashcards', 'ta_help'])).toEqual({ error: null })
    expect(s.outcomeUpdate).toHaveBeenCalledTimes(1)
    expect(s.outcomeUpdate.mock.calls[0][0]).toMatchObject({ what_helped: ['flashcards', 'ta_help'], what_helped_other: null })
    expect(s.outcomeUpdate.mock.calls[0][0].answered_at).toEqual(expect.any(String))
    expect(s.outcomeEqs).toEqual(expect.arrayContaining([['id', 'o1'], ['student_id', 'u1'], ['is:answered_at', null]]))
  })

  it('is add-only: an already-answered goal is a harmless no-op', async () => {
    const s = answerSetup({ outcome: { id: 'o1', goal_history_id: 'g1', answered_at: '2026-09-30T00:00:00Z', reminder_notification_id: null } })
    expect(await answerWhatHelped('o1', ['flashcards'])).toEqual({ error: null })
    expect(s.outcomeUpdate).not.toHaveBeenCalled()
  })

  it('treats a second click that loses the race (no row updated) as a no-op', async () => {
    const s = answerSetup({ updated: [], outcome: { id: 'o1', goal_history_id: 'g1', answered_at: null, reminder_notification_id: 'n1' } })
    expect(await answerWhatHelped('o1', ['flashcards'])).toEqual({ error: null })
    expect(s.notifUpdate).not.toHaveBeenCalled()
  })

  it('rejects nothing chosen, unknown options, and a blank or too-long "Other"', async () => {
    const s = answerSetup()
    expect((await answerWhatHelped('o1', [])).error).toMatch(/choose at least one/)
    expect((await answerWhatHelped('o1', ['nope'])).error).toMatch(/choose at least one/)
    expect((await answerWhatHelped('o1', ['other'], '  ')).error).toMatch(/choose at least one/)
    expect((await answerWhatHelped('o1', ['other'], 'x'.repeat(201))).error).toMatch(/choose at least one/)
    expect(s.outcomeUpdate).not.toHaveBeenCalled()
  })

  it('accepts the write-in, and the student\'s own study-plan text only when that goal had one', async () => {
    const withText = answerSetup({ goalRow: { study_plan: ['other'], study_plan_other: 'Pair with a friend' } })
    expect(await answerWhatHelped('o1', ['own_plan', 'other'], ' A study group ')).toEqual({ error: null })
    expect(withText.outcomeUpdate.mock.calls[0][0]).toMatchObject({ what_helped: ['own_plan', 'other'], what_helped_other: 'A study group' })

    const without = answerSetup()
    expect((await answerWhatHelped('o1', ['own_plan'])).error).toMatch(/choose at least one/)
    expect(without.outcomeUpdate).not.toHaveBeenCalled()
  })

  it('marks the reminder read and clears it from the bell once answered, so only skipped questions keep one', async () => {
    const s = answerSetup({ outcome: { id: 'o1', goal_history_id: 'g1', answered_at: null, reminder_notification_id: 'n1' } })
    await answerWhatHelped('o1', ['flashcards'])
    expect(s.notifUpdate).toHaveBeenCalledWith({ read: true, cleared_at: expect.any(String) })
    expect(s.notifEqs).toEqual(expect.arrayContaining([['id', 'n1'], ['user_id', 'u1']]))
  })

  it('returns a non-blaming error when saving fails', async () => {
    answerSetup({ updateError: { message: 'db down' } })
    expect((await answerWhatHelped('o1', ['flashcards'])).error).toMatch(/couldn't save your answer/)
  })
})

// ─── setSkillGoal ──────────────────────────────────────────────────────────────────────────

interface GoalOpts {
  user?: { id: string } | null
  role?: string
  progress?: Record<string, unknown> | null
  head?: { id: string } | null
  met?: { id: string } | null
  latest?: { rating: number } | null
  updated?: { id: string }[]
}

const progressRow = (over: Record<string, unknown> = {}) => ({
  skill_id: 's1', goal: null, updated_at: '2026-09-30T10:00:00.123456+00:00', ...over,
})
const goalInput = { goal: 8, targetDate: '2999-01-01', studyPlan: ['flashcards' as const] }

function goalSetup(opts: GoalOpts = {}) {
  const { user = { id: 'u1' }, role = 'student' } = opts
  const progress = opts.progress === undefined ? progressRow() : opts.progress
  const update = vi.fn()
  const eqs: [string, unknown][] = []

  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      if (table === 'users') return { select: () => chain({ data: { role } }) }
      if (table === 'confidence_tracker_skill_progress') {
        return {
          select: () => chain({ data: progress }),
          update: (payload: unknown) => {
            update(payload)
            const c: Record<string, unknown> = {}
            c.eq = (col: string, val: unknown) => { eqs.push([col, val]); return c }
            c.select = () => Promise.resolve({ data: opts.updated ?? [{ id: 'p1' }], error: null })
            return c
          },
        }
      }
      if (table === 'confidence_tracker_goal_history') {
        const head = opts.head === undefined ? { id: 'g1' } : opts.head
        return { select: () => chain({ data: head ? [{ ...head, skill_id: 's1' }] : [], error: null }) }
      }
      if (table === 'confidence_tracker_goal_outcomes') {
        return { select: () => chain({ data: opts.met ? [{ goal_history_id: 'g1' }] : [], error: null }) }
      }
      if (table === 'confidence_tracker_ratings') return { select: () => chain({ data: opts.latest === undefined ? { rating: 5 } : opts.latest }) }
      throw new Error(`unexpected table ${table}`)
    },
  } as never)
  return { update, eqs }
}

describe('setSkillGoal', () => {
  it('is rejected when the flag is off, unauthenticated, or for staff, without writing', async () => {
    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(false)
    const off = goalSetup()
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/not available/)
    expect(off.update).not.toHaveBeenCalled()

    vi.mocked(isConfidenceRatingsEnabled).mockReturnValue(true)
    const anon = goalSetup({ user: null })
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/logged in/)
    expect(anon.update).not.toHaveBeenCalled()

    const staff = goalSetup({ role: 'staff' })
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/Staff cannot/)
    expect(staff.update).not.toHaveBeenCalled()
  })

  it('sets a first goal on a skill with none, on the caller\'s own row, guarded by updated_at', async () => {
    const s = goalSetup()
    expect(await setSkillGoal('s1', goalInput)).toEqual({ error: null })
    expect(s.update).toHaveBeenCalledWith({
      goal: 8, goal_is_maintain: false, target_date: '2999-01-01', study_plan: ['flashcards'], study_plan_other: null,
    })
    expect(s.eqs).toEqual(expect.arrayContaining([
      ['student_id', 'u1'], ['skill_id', 's1'], ['updated_at', '2026-09-30T10:00:00.123456+00:00'],
    ]))
  })

  it('sets a next goal once the current goal has been met', async () => {
    const s = goalSetup({ progress: progressRow({ goal: 7 }), met: { id: 'o1' } })
    expect(await setSkillGoal('s1', goalInput)).toEqual({ error: null })
    expect(s.update).toHaveBeenCalledTimes(1)
  })

  it('refuses a second goal while the current one is still open', async () => {
    const open = goalSetup({ progress: progressRow({ goal: 7 }), met: null })
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/already have a goal in progress/)
    expect(open.update).not.toHaveBeenCalled()
  })

  it('allows a goal after a dip below 10 even when only an old maintain-only progress row exists', async () => {
    const s = goalSetup({ progress: progressRow({ goal: null, goal_is_maintain: true }), latest: { rating: 7 } })
    expect(await setSkillGoal('s1', goalInput)).toEqual({ error: null })
    expect(s.update).toHaveBeenCalledWith(expect.objectContaining({ goal: 8, goal_is_maintain: false }))
  })

  it('needs a rating first, and offers no goal at a rating of 10', async () => {
    const none = goalSetup({ progress: null })
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/Rate this skill/)
    expect(none.update).not.toHaveBeenCalled()

    const noRating = goalSetup({ latest: null })
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/Rate this skill/)
    expect(noRating.update).not.toHaveBeenCalled()

    const top = goalSetup({ latest: { rating: 10 } })
    expect((await setSkillGoal('s1', goalInput)).error).toMatch(/check your goal/)
    expect(top.update).not.toHaveBeenCalled()
  })

  it('applies the submission rules: at least current + 1, a future date, at least one study plan', async () => {
    const s = goalSetup({ latest: { rating: 8 } })
    expect((await setSkillGoal('s1', { ...goalInput, goal: 8 })).error).toMatch(/check your goal/)
    expect((await setSkillGoal('s1', { ...goalInput, targetDate: '2000-01-01' })).error).toMatch(/check your goal/)
    expect((await setSkillGoal('s1', { ...goalInput, studyPlan: [] })).error).toMatch(/check your goal/)
    // @ts-expect-error 'maintain' is no longer a valid goal input
    expect((await setSkillGoal('s1', { goal: 'maintain' })).error).toMatch(/check your goal/)
    expect(s.update).not.toHaveBeenCalled()
    expect(await setSkillGoal('s1', { ...goalInput, goal: 9 })).toEqual({ error: null })
  })

  it('treats a repeated call that matches no row as a harmless no-op', async () => {
    goalSetup({ updated: [] })
    expect(await setSkillGoal('s1', goalInput)).toEqual({ error: null })
  })
})

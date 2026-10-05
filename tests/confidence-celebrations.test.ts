import { describe, it, expect } from 'vitest'
import {
  buildCelebrations,
  findFirstTens,
  findReturnsToTen,
  findMetGoals,
  withoutCelebrated,
  type HeadGoal,
  type ProgressGoalRow,
} from '@/lib/confidence-celebrations'

const progress = (goal: number | null, goal_is_maintain = false): Map<string, ProgressGoalRow> =>
  new Map([['s1', { goal, goal_is_maintain }]])
const head = (over: Partial<HeadGoal> = {}): Map<string, HeadGoal> =>
  new Map([['s1', { id: 'g1', goal: 7, goal_is_maintain: false, study_plan: ['flashcards'], study_plan_other: null, ...over }]])

describe('findMetGoals', () => {
  const entries = (rating: number) => [{ skillId: 's1', rating }]

  it('meets a goal with a rating equal to or above it, not below', () => {
    expect(findMetGoals(entries(7), progress(7), head(), new Set())).toHaveLength(1)
    expect(findMetGoals(entries(9), progress(7), head(), new Set())).toHaveLength(1)
    expect(findMetGoals(entries(6), progress(7), head(), new Set())).toEqual([])
  })

  it('never meets a maintaining goal, a skill with no goal, or one already met', () => {
    expect(findMetGoals(entries(10), progress(null, true), head({ goal: null, goal_is_maintain: true }), new Set())).toEqual([])
    expect(findMetGoals(entries(9), progress(null), new Map(), new Set())).toEqual([])
    expect(findMetGoals(entries(9), progress(7), head(), new Set(['g1']))).toEqual([])
  })

  it('ignores a history head that is not the goal the progress row holds', () => {
    expect(findMetGoals(entries(9), progress(7), head({ goal: 5 }), new Set())).toEqual([])
  })

  it('carries the student\'s own study-plan write-in, only when the plan included "other"', () => {
    const withOther = head({ study_plan: ['other'], study_plan_other: '  Pair with a friend ' })
    expect(findMetGoals(entries(8), progress(7), withOther, new Set())[0].ownPlanText).toBe('Pair with a friend')
    expect(findMetGoals(entries(8), progress(7), head({ study_plan_other: 'stale' }), new Set())[0].ownPlanText).toBeNull()
  })

  it('skips a blank rating (not in the entries) entirely', () => {
    expect(findMetGoals([], progress(7), head(), new Set())).toEqual([])
  })
})

describe('findReturnsToTen', () => {
  const prior = new Map([['s1', 6], ['s2', 10]])
  it('finds a 10 after an earlier rating below 10', () => {
    expect(findReturnsToTen([{ skillId: 's1', rating: 10 }], prior, new Set())).toEqual(['s1'])
  })
  it('ignores a 10 after a 10, a rating below 10, and a skill never rated', () => {
    expect(findReturnsToTen([{ skillId: 's2', rating: 10 }], prior, new Set())).toEqual([])
    expect(findReturnsToTen([{ skillId: 's1', rating: 9 }], prior, new Set())).toEqual([])
    expect(findReturnsToTen([{ skillId: 's3', rating: 10 }], prior, new Set())).toEqual([])
  })
  it('skips a skill whose goal was met on this submission', () => {
    expect(findReturnsToTen([{ skillId: 's1', rating: 10 }], prior, new Set(['s1']))).toEqual([])
  })
})

describe('findFirstTens', () => {
  it('finds only a 10 for a skill with no earlier rating', () => {
    const prior = new Map([['s1', 4]])
    const entries = [{ skillId: 's1', rating: 10 }, { skillId: 's2', rating: 10 }, { skillId: 's3', rating: 8 }]
    expect(findFirstTens(entries, prior)).toEqual(['s2'])
  })
})

describe('buildCelebrations', () => {
  const met = [{ skillId: 's1', rating: 8, goalHistoryId: 'g1', target: 7, ownPlanText: null }]
  const outcomes = new Map([['g1', 'o1']])
  const none = new Map<string, string>()

  it('celebrates a met goal with its outcome and offers a next goal below the top of the scale', () => {
    expect(buildCelebrations([{ skillId: 's1', rating: 8 }], outcomes, met, none, new Set())).toEqual([
      { skillId: 's1', rating: 8, kind: 'goal', goal: { outcomeId: 'o1', target: 7, ownPlanText: null, nextGoalAllowed: true } },
    ])
  })

  it('offers no next goal after a goal met at 10', () => {
    const m = [{ ...met[0], rating: 10, target: 10 }]
    const [item] = buildCelebrations([{ skillId: 's1', rating: 10 }], outcomes, m, none, new Set())
    expect(item.kind).toBe('goal')
    expect(item.goal?.nextGoalAllowed).toBe(false)
  })

  it('celebrates a return to 10 with the outcome, no target and no next goal', () => {
    expect(buildCelebrations([{ skillId: 's1', rating: 10 }], new Map(), [], new Map([['s1', 'o9']]), new Set())).toEqual([
      { skillId: 's1', rating: 10, kind: 'returned', goal: { outcomeId: 'o9', target: null, ownPlanText: null, nextGoalAllowed: false } },
    ])
  })

  it('celebrates a first-ever 10 with no goal and no question', () => {
    const items = buildCelebrations([{ skillId: 's1', rating: 10 }], new Map(), [], none, new Set(['s1']))
    expect(items).toEqual([{ skillId: 's1', rating: 10, kind: 'first' }])
    expect(items[0]).not.toHaveProperty('goal')
  })

  it('lets a met goal win over a return to 10 for the same skill', () => {
    const m = [{ ...met[0], rating: 10, target: 10 }]
    const items = buildCelebrations([{ skillId: 's1', rating: 10 }], outcomes, m, new Map([['s1', 'o9']]), new Set())
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'goal', goal: { outcomeId: 'o1' } })
  })

  it('drops a met goal whose outcome was not recorded (already met, or the insert failed)', () => {
    expect(buildCelebrations([{ skillId: 's1', rating: 8 }], new Map(), met, none, new Set())).toEqual([])
  })

  it('follows the order of the submitted entries and skips unrelated skills', () => {
    const items = buildCelebrations(
      [{ skillId: 's2', rating: 5 }, { skillId: 's1', rating: 8 }, { skillId: 's3', rating: 10 }],
      outcomes, met, none, new Set(['s3'])
    )
    expect(items.map(i => i.skillId)).toEqual(['s1', 's3'])
  })
})

describe('withoutCelebrated', () => {
  it('removes kudos for celebrated skills and keeps the rest', () => {
    const kudos = [{ skillId: 's1', from: 4, to: 7 }, { skillId: 's2', from: 2, to: 3 }]
    const celebrations = [{ skillId: 's1', rating: 7, kind: 'goal' as const }]
    expect(withoutCelebrated(kudos, celebrations)).toEqual([{ skillId: 's2', from: 2, to: 3 }])
  })
})

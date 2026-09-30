import { describe, it, expect } from 'vitest'
import {
  buildCelebrations,
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

describe('buildCelebrations', () => {
  const met = [{ skillId: 's1', rating: 8, goalHistoryId: 'g1', target: 7, ownPlanText: null }]
  const outcomes = new Map([['g1', 'o1']])

  it('celebrates a met goal with its outcome and offers a next goal below the top of the scale', () => {
    expect(buildCelebrations([{ skillId: 's1', rating: 8 }], outcomes, met, new Set())).toEqual([
      { skillId: 's1', rating: 8, mastered: false, goal: { outcomeId: 'o1', target: 7, ownPlanText: null, nextGoalAllowed: true } },
    ])
  })

  it('offers no next goal after a rating of 10', () => {
    const m = [{ ...met[0], rating: 10 }]
    expect(buildCelebrations([{ skillId: 's1', rating: 10 }], outcomes, m, new Set())[0].goal?.nextGoalAllowed).toBe(false)
  })

  it('celebrates mastery alone with no question', () => {
    expect(buildCelebrations([{ skillId: 's1', rating: 10 }], new Map(), [], new Set(['s1']))).toEqual([
      { skillId: 's1', rating: 10, mastered: true },
    ])
  })

  it('combines a met goal and mastery into one item, keeping the goal\'s question and no next goal', () => {
    const items = buildCelebrations([{ skillId: 's1', rating: 10 }], outcomes, [{ ...met[0], rating: 10, target: 10 }], new Set(['s1']))
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ mastered: true, goal: { outcomeId: 'o1', nextGoalAllowed: false } })
  })

  it('drops a met goal whose outcome was not recorded (already met, or the insert failed)', () => {
    expect(buildCelebrations([{ skillId: 's1', rating: 8 }], new Map(), met, new Set())).toEqual([])
  })

  it('follows the order of the submitted entries and skips unrelated skills', () => {
    const items = buildCelebrations(
      [{ skillId: 's2', rating: 5 }, { skillId: 's1', rating: 8 }, { skillId: 's3', rating: 10 }],
      outcomes, met, new Set(['s3'])
    )
    expect(items.map(i => i.skillId)).toEqual(['s1', 's3'])
  })
})

describe('withoutCelebrated', () => {
  it('removes kudos for celebrated skills and keeps the rest', () => {
    const kudos = [{ skillId: 's1', from: 4, to: 7 }, { skillId: 's2', from: 2, to: 3 }]
    const celebrations = [{ skillId: 's1', rating: 7, mastered: false }]
    expect(withoutCelebrated(kudos, celebrations)).toEqual([{ skillId: 's2', from: 2, to: 3 }])
  })
})

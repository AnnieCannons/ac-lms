import { describe, it, expect } from 'vitest'
import {
  buildSkillTrends,
  currentCourseScore,
  computeClassStats,
  latestRatingsBySkill,
  unansweredMetGoals,
  type AssignmentInfo,
  type GoalRow,
  type OutcomeRow,
  type RatingRow,
} from '@/lib/confidence-trend'

const SKILLS = [{ id: 's1', name: 'React' }, { id: 's2', name: 'CSS' }]

const ASSIGNMENTS: Record<string, AssignmentInfo> = {
  a1: { title: 'Hooks 1', courseId: 'c1', courseName: 'Frontend' },
  a2: { title: 'Hooks 2', courseId: 'c1', courseName: 'Frontend' },
  a3: { title: 'Capstone', courseId: 'c2', courseName: 'Advanced' },
  a4: { title: 'Portfolio', courseId: 'c1', courseName: 'Frontend' },
}

const rating = (id: string, assignmentId: string, value: number, createdAt: string, skillId = 's1'): RatingRow =>
  ({ id, skillId, rating: value, createdAt, assignmentId })

const goal = (createdAt: string, g: Partial<GoalRow> = {}): GoalRow => ({
  id: `g-${createdAt}`, skillId: 's1', goal: 7, goalIsMaintain: false, targetDate: '2026-11-01', studyPlan: ['flashcards'],
  studyPlanOther: null, createdAt, ...g,
})

const build = (over: Partial<Parameters<typeof buildSkillTrends>[0]> = {}) =>
  buildSkillTrends({ skills: SKILLS, ratings: [], assignments: ASSIGNMENTS, goals: [], ...over })

describe('buildSkillTrends', () => {
  it('lists only skills the student has rated, with ratings in chronological order', () => {
    const trends = build({
      ratings: [rating('r2', 'a2', 6, '2026-02-10T10:00:00Z'), rating('r1', 'a1', 4, '2026-02-01T10:00:00Z')],
    })
    expect(trends).toHaveLength(1)
    expect(trends[0].name).toBe('React')
    expect(trends[0].ratings.map(r => r.value)).toEqual([4, 6])
    expect(trends[0].ratings[0]).toMatchObject({ assignmentTitle: 'Hooks 1', courseName: 'Frontend' })
    expect(trends[0].latestRating).toBe(6)
  })

  it('shows no course breakpoint for a skill rated in a single course', () => {
    const [t] = build({ ratings: [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 6, '2026-02-10T10:00:00Z')] })
    expect(t.courseBreakpoints).toEqual([])
  })

  it('puts the divider between the last rating of the old course and the first of the new one', () => {
    const [t] = build({ ratings: [rating('r1', 'a1', 4, '2026-02-01T00:00:00Z'), rating('r3', 'a3', 7, '2026-06-01T00:00:00Z')] })
    expect(t.courseBreakpoints).toEqual([{ x: 1.5, label: 'Advanced' }])
  })

  it('marks every change of course when two concurrent courses alternate', () => {
    const [t] = build({
      ratings: [
        rating('r1', 'a1', 4, '2026-02-01T10:00:00Z'),
        rating('r3', 'a3', 5, '2026-02-02T10:00:00Z'),
        rating('r2', 'a2', 6, '2026-02-03T10:00:00Z'),
      ],
    })
    expect(t.courseBreakpoints.map(b => b.label)).toEqual(['Advanced', 'Frontend'])
  })

  it('names the first rating\'s course as the start, for single- and multi-course skills alike', () => {
    const [single] = build({ ratings: [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 6, '2026-02-10T10:00:00Z')] })
    expect(single.startCourseName).toBe('Frontend')
    const [multi] = build({ ratings: [rating('r3', 'a3', 7, '2026-01-01T10:00:00Z'), rating('r1', 'a1', 4, '2026-06-01T10:00:00Z')] })
    expect(multi.startCourseName).toBe('Advanced')
    const [unknown] = build({ ratings: [rating('r9', 'gone', 5, '2026-02-01T10:00:00Z')] })
    expect(unknown.startCourseName).toBeNull()
  })

  it('renders a rating on an assignment that can no longer be resolved', () => {
    const [t] = build({ ratings: [rating('r1', 'gone', 5, '2026-02-01T10:00:00Z')] })
    expect(t.ratings[0]).toMatchObject({ assignmentTitle: null, courseId: null, courseName: null })
    expect(t.courseBreakpoints).toEqual([])
  })

  it('flags ratings from the instructor page\'s course as current, others as earlier-course context', () => {
    const [t] = build({
      currentCourseId: 'c2',
      ratings: [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z'), rating('r3', 'a3', 7, '2026-06-01T10:00:00Z')],
    })
    expect(t.ratings.map(r => r.isCurrentCourse)).toEqual([false, true])
  })

  it('treats a skill whose latest rating is below 10 as growing, even after an earlier 10', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 7, '2026-03-01T10:00:00Z')],
    })
    expect(t.isMaintaining).toBe(false)
    expect(t.latestRating).toBe(7)
  })

  it('treats 10, 7, 10 as maintaining again', () => {
    const [t] = build({
      ratings: [
        rating('r1', 'a1', 10, '2026-02-01T10:00:00Z'),
        rating('r2', 'a2', 7, '2026-03-01T10:00:00Z'),
        rating('r3', 'a4', 10, '2026-04-01T10:00:00Z'),
      ],
    })
    expect(t.isMaintaining).toBe(true)
  })

  it('treats a legacy mastered-style skill (two 10s, latest 10) as maintaining, with no mastery fields', () => {
    const [t] = build({ ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 10, '2026-03-01T10:00:00Z')] })
    expect(t.isMaintaining).toBe(true)
    expect(t).not.toHaveProperty('isMastered')
    expect(t).not.toHaveProperty('events')
    expect(t).not.toHaveProperty('pendingNew')
  })

  it('keeps every goal visible as history and makes the newest one current', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 5, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 4, '2026-05-01T10:00:00Z')],
      goals: [goal('2026-02-01T10:00:00Z', { goal: 8 }), goal('2026-05-01T10:00:00Z', { goal: 6 })],
    })
    expect(t.currentGoal?.goal).toBe(6)
    expect(t.previousGoals.map(g => g.goal)).toEqual([8])
  })

  it('describes study plan labels including "Other" text', () => {
    const [t2] = build({
      ratings: [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z')],
      goals: [goal('2026-02-01T10:00:00Z', { studyPlan: ['flashcards', 'other'], studyPlanOther: 'Pair programming' })],
    })
    expect(t2.currentGoal?.studyPlanLabels).toEqual(['Study flashcards', 'Other: Pair programming'])
  })

  it('never treats an old maintain goal row as the current goal; it sits in the history', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z')],
      goals: [goal('2026-02-01T10:00:00Z', { goal: null, goalIsMaintain: true, targetDate: null, studyPlan: null })],
    })
    expect(t.currentGoal).toBeNull()
    expect(t.goalStatus).toBe('none')
    expect(t.previousGoals).toHaveLength(1)
    expect(t.previousGoals[0].isMaintain).toBe(true)
  })

  it('shows a skill with no goal without a goal block', () => {
    const [t] = build({ ratings: [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z')] })
    expect(t.currentGoal).toBeNull()
    expect(t.previousGoals).toEqual([])
  })
})

describe('class statistics', () => {
  it('uses each student\'s most recent rating per skill', () => {
    const bySkill = latestRatingsBySkill([
      { id: '1', studentId: 'u1', skillId: 's1', rating: 3, createdAt: '2026-01-01T00:00:00Z' },
      { id: '2', studentId: 'u1', skillId: 's1', rating: 8, createdAt: '2026-02-01T00:00:00Z' },
      { id: '3', studentId: 'u2', skillId: 's1', rating: 5, createdAt: '2026-01-15T00:00:00Z' },
      { id: '4', studentId: 'u1', skillId: 's2', rating: 2, createdAt: '2026-01-15T00:00:00Z' },
    ])
    expect(bySkill.s1.sort()).toEqual([5, 8])
    expect(bySkill.s2).toEqual([2])
  })

  it('computes average, median and distribution for an odd and an even count', () => {
    const odd = computeClassStats([2, 5, 8])
    expect(odd).toMatchObject({ n: 3, median: 5 })
    expect(odd.average).toBeCloseTo(5)
    expect(odd.distribution).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0, 0])

    const even = computeClassStats([2, 4, 6, 10])
    expect(even.median).toBe(5)
    expect(even.average).toBe(5.5)
    expect(even.distribution[9]).toBe(1)
  })

  it('handles a skill rated by a single student', () => {
    const one = computeClassStats([7])
    expect(one).toMatchObject({ n: 1, average: 7, median: 7 })
    expect(one.distribution[6]).toBe(1)
  })

  it('returns empty stats for no ratings', () => {
    expect(computeClassStats([])).toMatchObject({ n: 0, average: null, median: null })
  })
})

describe('currentCourseScore', () => {
  const t = (ratings: { value: number; cur: boolean }[]) =>
    ({ ratings: ratings.map(r => ({ value: r.value, date: '2026-01-01T00:00:00Z', assignmentTitle: null, courseId: null, courseName: null, isCurrentCourse: r.cur })) }) as never

  it('averages each skill\'s latest rating from this course, ignoring earlier courses', () => {
    expect(currentCourseScore([t([{ value: 2, cur: true }, { value: 6, cur: true }, { value: 10, cur: false }]), t([{ value: 4, cur: true }])])).toBe(5)
  })

  it('is null when nothing was rated in this course', () => {
    expect(currentCourseScore([t([{ value: 9, cur: false }])])).toBeNull()
    expect(currentCourseScore([])).toBeNull()
  })
})

describe('met goals (Phase 6)', () => {
  const outcome = (goalHistoryId: string | null, over: Partial<OutcomeRow> = {}): OutcomeRow => ({
    id: `o-${goalHistoryId}`, goalHistoryId, skillId: 's1', metAt: '2026-03-01T10:00:00Z', metRating: 8,
    whatHelped: null, whatHelpedOther: null, answeredAt: null, ...over,
  })
  const ratings = [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 8, '2026-03-01T10:00:00Z')]
  const baseGoal = goal('2026-02-01T10:00:00Z')

  it('marks an open goal as open, with no set-a-goal offer', () => {
    const [t] = build({ ratings, goals: [baseGoal] })
    expect(t.goalStatus).toBe('open')
    expect(t.currentGoal?.met).toBeNull()
    expect(t.canSetGoal).toBe(false)
  })

  it('moves a reached goal into the history, leaves no current goal, and allows a new one', () => {
    const [t] = build({ ratings, goals: [baseGoal], outcomes: [outcome(baseGoal.id)] })
    expect(t.goalStatus).toBe('met')
    expect(t.currentGoal).toBeNull()
    expect(t.previousGoals).toHaveLength(1)
    expect(t.previousGoals[0].met).toMatchObject({ outcomeId: `o-${baseGoal.id}`, rating: 8, answered: false, answerLabels: [], answerValues: [] })
    expect(t.canSetGoal).toBe(true)
  })

  it('words a saved answer as it was chosen, including the write-in and the student\'s own plan', () => {
    const own = goal('2026-02-01T10:00:00Z', { studyPlan: ['other'], studyPlanOther: 'Pair with a friend' })
    const [t] = build({
      ratings, goals: [own],
      outcomes: [outcome(own.id, { whatHelped: ['flashcards', 'own_plan', 'other'], whatHelpedOther: 'A study group', answeredAt: '2026-03-02T10:00:00Z' })],
    })
    expect(t.currentGoal).toBeNull()
    expect(t.previousGoals[0].met?.answered).toBe(true)
    expect(t.previousGoals[0].met?.answerLabels).toEqual(['Studying flashcards', 'Pair with a friend', 'Other: A study group'])
    expect(t.previousGoals[0].met?.answerValues).toEqual(['flashcards', 'own_plan', 'other'])
  })

  it('offers "set a goal" for a growing skill with no goal, never at 10', () => {
    expect(build({ ratings })[0]).toMatchObject({ goalStatus: 'none', canSetGoal: true })
    expect(build({ ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z')] })[0].canSetGoal).toBe(false)
  })

  it('lets a student set a goal after a dip below 10 even with an old maintain goal row', () => {
    const maintain = goal('2026-02-01T10:00:00Z', { goal: null, goalIsMaintain: true })
    const [t] = build({
      ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 7, '2026-03-01T10:00:00Z')],
      goals: [maintain],
    })
    expect(t).toMatchObject({ goalStatus: 'none', canSetGoal: true, isMaintaining: false })
    expect(t.currentGoal).toBeNull()
  })

  it('turns standalone outcomes (no goal) into reachedTens, newest first', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 6, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 10, '2026-03-01T10:00:00Z')],
      outcomes: [
        outcome(null, { id: 'o1', metAt: '2026-03-01T10:00:00Z', metRating: 10 }),
        outcome(null, { id: 'o2', metAt: '2026-04-01T10:00:00Z', metRating: 10, whatHelped: ['flashcards'], answeredAt: '2026-04-02T10:00:00Z' }),
      ],
    })
    expect(t.reachedTens.map(r => r.outcomeId)).toEqual(['o2', 'o1'])
    expect(t.reachedTens[0]).toMatchObject({ answered: true, answerValues: ['flashcards'], rating: 10 })
    expect(t.reachedTens[1]).toMatchObject({ answered: false, answerLabels: [] })
    expect(t.previousGoals).toEqual([])
  })

  it('keeps an earlier met goal\'s answer in the history after a newer goal is set', () => {
    const first = goal('2026-02-01T10:00:00Z', { goal: 7 })
    const second = goal('2026-03-05T10:00:00Z', { goal: 10 })
    const [t] = build({ ratings, goals: [first, second], outcomes: [outcome(first.id)] })
    expect(t.goalStatus).toBe('open')
    expect(t.previousGoals).toHaveLength(1)
    expect(t.previousGoals[0].met?.answered).toBe(false)
  })

  it('lists every unanswered reached goal, newest first, and drops answered ones', () => {
    const first = goal('2026-02-01T10:00:00Z', { goal: 7 })
    const second = goal('2026-03-05T10:00:00Z', { goal: 9 })
    const trends = build({
      ratings, goals: [first, second],
      outcomes: [
        outcome(first.id, { metAt: '2026-03-01T10:00:00Z' }),
        outcome(second.id, { metAt: '2026-03-20T10:00:00Z', answeredAt: '2026-03-21T10:00:00Z', whatHelped: ['flashcards'] }),
      ],
    })
    expect(unansweredMetGoals(trends)).toEqual([
      expect.objectContaining({ skillId: 's1', skillName: 'React', outcomeId: `o-${first.id}`, target: 7 }),
    ])
    expect(unansweredMetGoals(build({ ratings, goals: [first] }))).toEqual([])
  })

  it('lists an unanswered return to 10 with a null target alongside reached goals', () => {
    const first = goal('2026-02-01T10:00:00Z', { goal: 7 })
    const trends = build({
      ratings, goals: [first],
      outcomes: [
        outcome(first.id, { metAt: '2026-03-01T10:00:00Z' }),
        outcome(null, { id: 'ten1', metAt: '2026-04-01T10:00:00Z', metRating: 10 }),
        outcome(null, { id: 'ten2', metAt: '2026-05-01T10:00:00Z', metRating: 10, answeredAt: '2026-05-02T10:00:00Z', whatHelped: ['flashcards'] }),
      ],
    })
    const list = unansweredMetGoals(trends)
    expect(list.map(u => [u.outcomeId, u.target])).toEqual([['ten1', null], [`o-${first.id}`, 7]])
  })
})

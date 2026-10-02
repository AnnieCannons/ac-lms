import { describe, it, expect } from 'vitest'
import {
  buildSkillTrends,
  currentCourseScore,
  computeClassStats,
  latestRatingsBySkill,
  unansweredMetGoals,
  type AssignmentInfo,
  type EventRow,
  type GoalRow,
  type ProgressRow,
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
  buildSkillTrends({ skills: SKILLS, ratings: [], assignments: ASSIGNMENTS, goals: [], events: [], progress: [], ...over })

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

  it('treats a plain mastered skill as mastered with its date', () => {
    const events: EventRow[] = [{ skillId: 's1', eventType: 'mastered', createdAt: '2026-03-01T10:00:01Z' }]
    const progress: ProgressRow[] = [{ skillId: 's1', isMastered: true, isNewPending: false }]
    const [t] = build({
      ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 10, '2026-03-01T10:00:00Z')],
      events, progress,
    })
    expect(t.isMastered).toBe(true)
    expect(t.previouslyMastered).toBe(false)
    expect(t.masteredDates).toEqual(['2026-03-01T10:00:01Z'])
    // The mastery marker sits on the second 10, the rating that reached mastery.
    expect(t.events[0]).toMatchObject({ type: 'mastered', x: 2 })
  })

  it('puts the mastery marker on the latest 10 even when later ratings exist (e.g. backfilled data)', () => {
    const [t] = build({
      ratings: [
        rating('r1', 'a1', 10, '2026-02-01T10:00:00Z'),
        rating('r2', 'a2', 10, '2026-03-01T10:00:00Z'),
        rating('r3', 'a4', 6, '2026-03-05T10:00:00Z'),
      ],
      events: [{ skillId: 's1', eventType: 'mastered', createdAt: '2026-03-10T10:00:00Z' }],
      progress: [{ skillId: 's1', isMastered: true, isNewPending: false }],
    })
    expect(t.events[0].x).toBe(2)
  })

  it('finds the second 10 from the ratings even if the mastery timestamp sits just before it (clock skew)', () => {
    const [t] = build({
      ratings: [
        rating('r1', 'a1', 6, '2026-02-01T10:00:00Z'),
        rating('r2', 'a2', 10, '2026-03-01T10:00:00Z'),
        rating('r3', 'a4', 10, '2026-03-05T10:00:00.500Z'),
      ],
      events: [{ skillId: 's1', eventType: 'mastered', createdAt: '2026-03-05T10:00:00.100Z' }],
      progress: [{ skillId: 's1', isMastered: true, isNewPending: false }],
    })
    expect(t.events[0].x).toBe(3)
  })

  it('counts only the 10s since the last reactivation when placing a later mastery marker', () => {
    const [t] = build({
      ratings: [
        rating('r1', 'a1', 10, '2026-01-01T10:00:00Z'),
        rating('r2', 'a2', 10, '2026-01-10T10:00:00Z'),
        rating('r3', 'a3', 4, '2026-03-01T10:00:00Z'),
        rating('r4', 'a4', 10, '2026-04-01T10:00:00Z'),
        rating('r5', 'a1b', 10, '2026-05-01T10:00:00Z'),
      ],
      events: [
        { skillId: 's1', eventType: 'mastered', createdAt: '2026-01-10T10:00:01Z' },
        { skillId: 's1', eventType: 'reactivated', createdAt: '2026-02-01T10:00:00Z' },
        { skillId: 's1', eventType: 'mastered', createdAt: '2026-05-01T10:00:01Z' },
      ],
      progress: [{ skillId: 's1', isMastered: true, isNewPending: false }],
    })
    expect(t.events.map(e => [e.type, e.x])).toEqual([['mastered', 2], ['reactivated', 2.5], ['mastered', 5]])
  })

  it('falls back to the last rating when no 10 exists before the mastery event', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 6, '2026-02-01T10:00:00Z'), rating('r2', 'a2', 7, '2026-03-01T10:00:00Z')],
      events: [{ skillId: 's1', eventType: 'mastered', createdAt: '2026-03-10T10:00:00Z' }],
    })
    expect(t.events[0].x).toBe(2)
  })

  it('keeps the earlier goal and mastery visible after reactivation, and shows every cycle', () => {
    const events: EventRow[] = [
      { skillId: 's1', eventType: 'mastered', createdAt: '2026-03-01T10:00:01Z' },
      { skillId: 's1', eventType: 'reactivated', createdAt: '2026-04-01T10:00:00Z' },
      { skillId: 's1', eventType: 'mastered', createdAt: '2026-06-01T10:00:01Z' },
      { skillId: 's1', eventType: 'reactivated', createdAt: '2026-07-01T10:00:00Z' },
    ]
    const [t] = build({
      ratings: [
        rating('r1', 'a1', 5, '2026-02-01T10:00:00Z'),
        rating('r2', 'a2', 10, '2026-03-01T10:00:00Z'),
        rating('r3', 'a3', 4, '2026-05-01T10:00:00Z'),
        rating('r4', 'a4', 10, '2026-06-01T10:00:00Z'),
      ],
      events,
      goals: [goal('2026-02-01T10:00:00Z', { goal: 8 }), goal('2026-05-01T10:00:00Z', { goal: 6 })],
      progress: [{ skillId: 's1', isMastered: false, isNewPending: true }],
    })
    expect(t.isMastered).toBe(false)
    expect(t.previouslyMastered).toBe(true)
    expect(t.masteredDates).toHaveLength(2)
    expect(t.reactivatedDates).toHaveLength(2)
    expect(t.pendingNew).toBe(true)
    expect(t.events.map(e => e.label)).toEqual(['Mastered', 'Reactivated', 'Mastered', 'Reactivated'])
    // Both goals survive; the one set before the latest reactivation is history, not current.
    expect(t.currentGoal).toBeNull()
    expect(t.previousGoals.map(g => g.goal)).toEqual([6, 8])
  })

  it('makes a goal captured after the latest reactivation the current goal, keeping the old one as history', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 10, '2026-03-01T10:00:00Z'), rating('r2', 'a2', 3, '2026-05-01T10:00:00Z')],
      events: [
        { skillId: 's1', eventType: 'mastered', createdAt: '2026-03-01T10:00:01Z' },
        { skillId: 's1', eventType: 'reactivated', createdAt: '2026-04-01T10:00:00Z' },
      ],
      goals: [goal('2026-02-01T10:00:00Z', { goal: 8 }), goal('2026-05-01T10:00:00Z', { goal: 5 })],
      progress: [{ skillId: 's1', isMastered: false, isNewPending: false }],
    })
    expect(t.currentGoal?.goal).toBe(5)
    expect(t.previousGoals.map(g => g.goal)).toEqual([8])
    expect(t.pendingNew).toBe(false)
  })

  it('describes a maintaining goal and study plan labels including "Other" text', () => {
    const [t] = build({
      ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z')],
      goals: [goal('2026-02-01T10:00:00Z', { goal: null, goalIsMaintain: true, targetDate: null, studyPlan: null })],
    })
    expect(t.currentGoal).toMatchObject({ isMaintain: true, goal: null, targetDate: null, studyPlanLabels: [] })

    const [t2] = build({
      ratings: [rating('r1', 'a1', 4, '2026-02-01T10:00:00Z')],
      goals: [goal('2026-02-01T10:00:00Z', { studyPlan: ['flashcards', 'other'], studyPlanOther: 'Pair programming' })],
    })
    expect(t2.currentGoal?.studyPlanLabels).toEqual(['Study flashcards', 'Other: Pair programming'])
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
  const outcome = (goalHistoryId: string, over: Partial<OutcomeRow> = {}): OutcomeRow => ({
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

  it('offers "set a goal" for a skill with no goal, but not above a rating of 10, for maintaining, mastered or reactivated skills', () => {
    expect(build({ ratings })[0]).toMatchObject({ goalStatus: 'none', canSetGoal: true })
    expect(build({ ratings: [rating('r1', 'a1', 10, '2026-02-01T10:00:00Z')] })[0].canSetGoal).toBe(false)
    expect(build({ ratings, goals: [goal('2026-02-01T10:00:00Z', { goal: null, goalIsMaintain: true })] })[0]).toMatchObject({ goalStatus: 'maintain', canSetGoal: false })
    expect(build({ ratings, progress: [{ skillId: 's1', isMastered: true, isNewPending: false }] })[0].canSetGoal).toBe(false)
    const events: EventRow[] = [{ skillId: 's1', eventType: 'reactivated', createdAt: '2026-04-01T10:00:00Z' }]
    expect(build({ ratings, events, progress: [{ skillId: 's1', isMastered: false, isNewPending: true }] })[0].canSetGoal).toBe(false)
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
})

import { describe, it, expect } from 'vitest'
import { computeWhatHelpedPatterns, computeClassPatterns } from '@/lib/confidence-patterns'
import type { SkillTrend, TrendGoal, TrendGoalMet } from '@/lib/confidence-trend'

let n = 0
// A reached goal; `values` null = reached but not answered yet.
const metGoal = (values: string[] | null): TrendGoal => ({
  id: `g${++n}`, goal: 7, isMaintain: false, targetDate: '2026-03-01', studyPlanLabels: [], ownPlanText: null, setAt: '2026-02-01T10:00:00Z',
  met: { outcomeId: `o${n}`, metAt: '2026-03-02T10:00:00Z', rating: 7, answered: values !== null, answerLabels: [], answerValues: values ?? [] },
})
const openGoal = (): TrendGoal => ({ ...metGoal(null), met: null })

// A return to 10 with no goal; `values` null = not answered yet.
const tenReached = (values: string[] | null): TrendGoalMet => ({
  outcomeId: `t${++n}`, metAt: '2026-04-01T10:00:00Z', rating: 10, answered: values !== null, answerLabels: [], answerValues: values ?? [],
})

const skill = (skillId: string, name: string, over: Partial<SkillTrend> = {}): SkillTrend => ({
  skillId, name, ratings: [], startCourseName: null, courseBreakpoints: [],
  currentGoal: null, previousGoals: [], reachedTens: [], isMaintaining: false, latestRating: 5, goalStatus: 'none', canSetGoal: false, ...over,
})

describe('computeWhatHelpedPatterns', () => {
  it('returns nothing for no trends or no answers', () => {
    expect(computeWhatHelpedPatterns([])).toEqual({ answeredGoals: 0, methods: [] })
    const t = skill('s1', 'React', { currentGoal: openGoal(), previousGoals: [metGoal(null)] })
    expect(computeWhatHelpedPatterns([t])).toEqual({ answeredGoals: 0, methods: [] })
  })

  it('shows results from a single answer (no minimum)', () => {
    const t = skill('s1', 'React', { previousGoals: [metGoal(['flashcards'])] })
    const p = computeWhatHelpedPatterns([t])
    expect(p.answeredGoals).toBe(1)
    expect(p.methods).toEqual([
      { value: 'flashcards', label: 'Studying flashcards', count: 1, skills: [{ skillId: 's1', name: 'React', count: 1 }] },
    ])
  })

  it('counts a goal once toward each method it named, with its skill under each', () => {
    const t = skill('s1', 'React', { previousGoals: [metGoal(['flashcards', 'ta_help'])] })
    const p = computeWhatHelpedPatterns([t])
    expect(p.answeredGoals).toBe(1)
    expect(p.methods.map(m => [m.value, m.count])).toEqual([['ta_help', 1], ['flashcards', 1]])
    expect(p.methods.every(m => m.skills[0].name === 'React')).toBe(true)
  })

  it('counts per skill across current and earlier goals, and across skills', () => {
    const react = skill('s1', 'React', { currentGoal: metGoal(['flashcards']), previousGoals: [metGoal(['flashcards']), metGoal(['flashcards'])] })
    const css = skill('s2', 'CSS', { previousGoals: [metGoal(['flashcards'])] })
    const [m] = computeWhatHelpedPatterns([css, react]).methods
    expect(m.count).toBe(4)
    expect(m.skills.map(s => [s.name, s.count])).toEqual([['React', 3], ['CSS', 1]])
  })

  it('folds "other" and the student\'s own plan into one Other, counted once per goal', () => {
    const t = skill('s1', 'React', { previousGoals: [metGoal(['own_plan', 'other']), metGoal(['own_plan'])] })
    const p = computeWhatHelpedPatterns([t])
    expect(p.methods).toHaveLength(1)
    expect(p.methods[0]).toMatchObject({ value: 'other', label: 'Other', count: 2 })
  })

  it('ignores unanswered goals, open goals and unknown values', () => {
    const t = skill('s1', 'React', { currentGoal: openGoal(), previousGoals: [metGoal(null), metGoal(['mystery'])] })
    expect(computeWhatHelpedPatterns([t])).toEqual({ answeredGoals: 0, methods: [] })
  })

  it('orders methods by count, then the option order with Other last', () => {
    const t = skill('s1', 'React', {
      previousGoals: [metGoal(['other']), metGoal(['review_notes']), metGoal(['practice_alone']), metGoal(['flashcards']), metGoal(['flashcards'])],
    })
    expect(computeWhatHelpedPatterns([t]).methods.map(m => m.value)).toEqual(['flashcards', 'practice_alone', 'review_notes', 'other'])
  })

  it('orders skills by count, then name, and uses the current (renamed) skill name', () => {
    const b = skill('s2', 'Beta', { previousGoals: [metGoal(['flashcards'])] })
    const a = skill('s1', 'Alpha', { previousGoals: [metGoal(['flashcards'])] })
    expect(computeWhatHelpedPatterns([b, a]).methods[0].skills.map(s => s.name)).toEqual(['Alpha', 'Beta'])
  })

  it('counts a return-to-10 answer toward its methods and skills like a goal answer', () => {
    const t = skill('s1', 'Git', {
      isMaintaining: true, latestRating: 10,
      previousGoals: [metGoal(['flashcards'])], reachedTens: [tenReached(['flashcards', 'ta_help']), tenReached(null)],
    })
    const p = computeWhatHelpedPatterns([t])
    expect(p.answeredGoals).toBe(2)
    expect(p.methods.map(m => [m.value, m.count])).toEqual([['flashcards', 2], ['ta_help', 1]])
    expect(p.methods[0].skills).toEqual([{ skillId: 's1', name: 'Git', count: 2 }])
  })
})

describe('computeClassPatterns', () => {
  it('sums methods and skills across students and counts the students it rests on', () => {
    const ada = [skill('s1', 'React', { previousGoals: [metGoal(['flashcards', 'ta_help'])] })]
    const grace = [skill('s1', 'React', { previousGoals: [metGoal(['flashcards'])] }), skill('s2', 'CSS', { previousGoals: [metGoal(['flashcards'])] })]
    const linus = [skill('s1', 'React', { currentGoal: openGoal(), previousGoals: [metGoal(null)] })]
    const p = computeClassPatterns([ada, grace, linus])
    expect(p.answeredGoals).toBe(3)
    expect(p.answeredStudents).toBe(2)
    expect(p.methods.map(m => [m.value, m.count])).toEqual([['flashcards', 3], ['ta_help', 1]])
    expect(p.methods[0].skills).toEqual([
      { skillId: 's1', name: 'React', count: 2 },
      { skillId: 's2', name: 'CSS', count: 1 },
    ])
  })

  it('folds own write-ins and Other into one Other, counted once per goal', () => {
    const t = [skill('s1', 'React', { previousGoals: [metGoal(['own_plan', 'other']), metGoal(['other'])] })]
    const p = computeClassPatterns([t])
    expect(p.methods).toEqual([{ value: 'other', label: 'Other', count: 2, skills: [{ skillId: 's1', name: 'React', count: 2 }] }])
  })

  it('returns nothing for an empty class or one with no answers, and carries no student identity', () => {
    expect(computeClassPatterns([])).toEqual({ answeredGoals: 0, methods: [], answeredStudents: 0 })
    expect(computeClassPatterns([[skill('s1', 'React', { currentGoal: openGoal() })], []])).toEqual({ answeredGoals: 0, methods: [], answeredStudents: 0 })
    const p = computeClassPatterns([[skill('s1', 'React', { previousGoals: [metGoal(['flashcards'])] })]])
    expect(Object.keys(p).sort()).toEqual(['answeredGoals', 'answeredStudents', 'methods'])
  })

  it('narrows to a skill when given skill-filtered trends', () => {
    const all = [skill('s1', 'React', { previousGoals: [metGoal(['flashcards'])] }), skill('s2', 'CSS', { previousGoals: [metGoal(['ta_help'])] })]
    const p = computeClassPatterns([all.filter(t => t.skillId === 's2')])
    expect(p.methods.map(m => m.value)).toEqual(['ta_help'])
  })

  it('includes return-to-10 answers in class counts', () => {
    const p = computeClassPatterns([[skill('s1', 'Git', { reachedTens: [tenReached(['practice_alone'])] })]])
    expect(p).toMatchObject({ answeredGoals: 1, answeredStudents: 1 })
    expect(p.methods.map(m => m.value)).toEqual(['practice_alone'])
  })
})

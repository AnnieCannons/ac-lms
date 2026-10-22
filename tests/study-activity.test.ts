import { describe, it, expect } from 'vitest'
import { computeStudyActivity, expandQuizAttempts, rangeStart, weekStart, type QuizAttempt, type FlashcardSession } from '@/lib/study-activity'

const students = [
  { id: 'a', name: 'Ana' },
  { id: 'b', name: 'Bo' },
  { id: 'c', name: 'Cy' },
]
const quizzes = [{ id: 'q1', title: 'Flexbox', moduleTitle: 'Week 3' }]
// Noon Pacific on a date, so the Pacific day is unambiguous.
const at = (date: string) => `${date}T19:00:00Z`
const TODAY = '2026-10-22' // a Thursday

const run = (attempts: QuizAttempt[], sessions: FlashcardSession[], range: '7' | '28' | 'all' = '28') =>
  computeStudyActivity({ students, quizzes, attempts, sessions, today: TODAY, courseStart: '2026-09-01', range })

describe('expandQuizAttempts', () => {
  it('uses attempt_history when present, else one attempt at submitted_at', () => {
    const out = expandQuizAttempts([
      { quiz_id: 'q1', student_id: 'a', submitted_at: at('2026-10-20'), score_percent: 90, attempt_history: [
        { submitted_at: at('2026-10-10'), score_percent: 50 },
        { submitted_at: at('2026-10-20'), score_percent: 90 },
      ] },
      { quiz_id: 'q1', student_id: 'b', submitted_at: at('2026-10-15'), score_percent: 70, attempt_history: [] },
    ])
    expect(out).toEqual([
      { studentId: 'a', quizId: 'q1', at: at('2026-10-10'), score: 50 },
      { studentId: 'a', quizId: 'q1', at: at('2026-10-20'), score: 90 },
      { studentId: 'b', quizId: 'q1', at: at('2026-10-15'), score: 70 },
    ])
  })
})

describe('date helpers', () => {
  it('weekStart is the Monday', () => {
    expect(weekStart('2026-10-22')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19') // Sunday
  })
  it('rangeStart never goes before the course start', () => {
    expect(rangeStart('7', TODAY, '2026-09-01')).toBe('2026-10-16')
    expect(rangeStart('28', TODAY, '2026-10-10')).toBe('2026-10-10')
    expect(rangeStart('all', TODAY, '2026-09-01')).toBe('2026-09-01')
  })
})

describe('computeStudyActivity', () => {
  it('counts a day with both a quiz and flashcards as one active day', () => {
    const r = run(
      [{ studentId: 'a', quizId: 'q1', at: at('2026-10-21'), score: 80 }],
      [{ studentId: 'a', at: at('2026-10-21'), cards: 40 }, { studentId: 'a', at: at('2026-10-15'), cards: 10 }],
    )
    const ana = r.students.find(s => s.id === 'a')!
    expect(ana.activeDays).toBe(2)
    expect(ana.quizAttempts).toBe(1)
    expect(ana.cardsStudied).toBe(50)
    expect(ana.flashcardSessions).toBe(2)
    expect(ana.strip.at(-2)).toEqual({ date: '2026-10-21', quiz: true, cards: true })
  })

  it('sorts least active first and summarises the class', () => {
    const r = run(
      [{ studentId: 'a', quizId: 'q1', at: at('2026-10-21'), score: 80 }],
      [{ studentId: 'b', at: at('2026-10-01'), cards: 5 }],
    )
    expect(r.students.map(s => s.id)).toEqual(['c', 'b', 'a'])
    expect(r.summary).toMatchObject({ enrolled: 3, studied: 2, quiet7: 2, medianActiveDays: 1 })
  })

  it('uses Pacific days, not UTC', () => {
    // 2026-10-22 03:00 UTC is still the evening of Oct 21 in Pacific.
    const r = run([], [{ studentId: 'a', at: '2026-10-22T03:00:00Z', cards: 5 }], '7')
    expect(r.students.find(s => s.id === 'a')!.strip.at(-2)).toEqual({ date: '2026-10-21', quiz: false, cards: true })
  })

  it('compares with the previous period for 7/28 days only', () => {
    const sessions = [{ studentId: 'a', at: at('2026-10-10'), cards: 5 }, { studentId: 'b', at: at('2026-10-12'), cards: 5 }]
    expect(run([], sessions, '7').summary.studiedPrev).toBe(2)
    expect(run([], sessions, 'all').summary.studiedPrev).toBeNull()
  })

  it('reports per-quiz first vs best scores within the range', () => {
    const r = run([
      { studentId: 'a', quizId: 'q1', at: at('2026-10-10'), score: 50 },
      { studentId: 'a', quizId: 'q1', at: at('2026-10-12'), score: 100 },
      { studentId: 'b', quizId: 'q1', at: at('2026-10-11'), score: 70 },
    ], [])
    expect(r.quizzes[0]).toMatchObject({ students: 2, attempts: 3, avgFirst: 60, avgBest: 85 })
  })

  it('counts students active per week', () => {
    const r = run([], [
      { studentId: 'a', at: at('2026-10-20'), cards: 5 },
      { studentId: 'b', at: at('2026-10-13'), cards: 5 },
      { studentId: 'a', at: at('2026-10-14'), cards: 5 },
    ], '28')
    expect(r.weeks.at(-1)).toEqual({ week: '2026-10-19', studied: 1, quizStudents: 0, cardStudents: 1 })
    expect(r.weeks.at(-2)).toEqual({ week: '2026-10-12', studied: 2, quizStudents: 0, cardStudents: 2 })
  })

  it('ignores activity from people not enrolled as students', () => {
    const r = run([], [{ studentId: 'zz', at: at('2026-10-20'), cards: 5 }])
    expect(r.summary.studied).toBe(0)
  })
})

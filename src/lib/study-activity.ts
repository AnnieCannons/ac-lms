// Pure rules for the instructor Study Activity page: practice quizzes + flashcards for one course.
// Nothing here touches the database, so the page can switch date ranges on the client.
//
// The two sources aren't comparable in size (50 flashcards vs one quiz attempt), so the shared
// measure is an "active day": a Pacific calendar day on which the student did any studying.
// Per-source counts sit beside it rather than being added into one total.

import { addDays, pacificDate } from './cutting-edge'

export type StudyStudent = { id: string; name: string }

export type PracticeQuiz = { id: string; title: string; moduleTitle: string | null }

/** One submitted attempt at a practice quiz. */
export type QuizAttempt = { studentId: string; quizId: string; at: string; score: number | null }

/** One flashcard study session. Flashcards aren't course-scoped, so these are all of a student's decks. */
export type FlashcardSession = { studentId: string; at: string; cards: number }

export type StudyRange = '7' | '28' | 'all'

export const STRIP_DAYS = 28

type AttemptRecord = { started_at?: string | null; submitted_at?: string | null; score_percent?: number | null }

/**
 * Expands quiz_submissions rows (one per student per quiz) into individual attempts.
 * Uses attempt_history when present; older rows without it count as one attempt at submitted_at.
 */
export function expandQuizAttempts(
  rows: { quiz_id: string; student_id: string; submitted_at: string; score_percent: number | null; attempt_history: unknown }[],
): QuizAttempt[] {
  const out: QuizAttempt[] = []
  for (const r of rows) {
    const history = Array.isArray(r.attempt_history) ? (r.attempt_history as AttemptRecord[]) : []
    const dated = history.filter(h => h.submitted_at)
    if (dated.length === 0) {
      out.push({ studentId: r.student_id, quizId: r.quiz_id, at: r.submitted_at, score: r.score_percent })
    } else {
      for (const h of dated) {
        out.push({ studentId: r.student_id, quizId: r.quiz_id, at: h.submitted_at!, score: h.score_percent ?? null })
      }
    }
  }
  return out
}

/** The first day (inclusive) of a range ending today. */
export function rangeStart(range: StudyRange, today: string, courseStart: string): string {
  if (range === 'all') return courseStart
  const start = addDays(today, -(Number(range) - 1))
  return start < courseStart ? courseStart : start
}

/** Monday (Pacific calendar) of the week a date falls in. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return addDays(date, -((dow + 6) % 7))
}

export type StripDay = { date: string; quiz: boolean; cards: boolean }

export type StudentQuizSummary = { quizId: string; title: string; attempts: number; best: number | null; lastAt: string }

export type StudentRow = {
  id: string
  name: string
  activeDays: number
  quizAttempts: number
  cardsStudied: number
  flashcardSessions: number
  /** Latest activity of any kind, all time (not limited to the range). */
  lastActive: string | null
  /** The last STRIP_DAYS days ending today, oldest first. */
  strip: StripDay[]
  quizzes: StudentQuizSummary[]
}

export type WeekBar = { week: string; studied: number; quizStudents: number; cardStudents: number }

/** One student's attempts at one practice quiz, within the range. */
export type QuizTaker = { studentId: string; name: string; attempts: number; first: number | null; best: number | null; lastAt: string }

export type QuizRow = {
  quizId: string
  title: string
  moduleTitle: string | null
  students: number
  attempts: number
  avgFirst: number | null
  avgBest: number | null
  /** Who took it, most recent first. */
  takers: QuizTaker[]
}

export type StudySummary = {
  enrolled: number
  /** Students with at least one active day in the range. */
  studied: number
  /** Students with no activity in the last 7 days. */
  quiet7: number
  medianActiveDays: number
  /** Students who studied in the equivalent period before this one; null for 'all'. */
  studiedPrev: number | null
}

export type StudyActivity = {
  from: string
  to: string
  summary: StudySummary
  students: StudentRow[]
  weeks: WeekBar[]
  quizzes: QuizRow[]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

/** Least active first: fewest active days, then longest since last activity (never active first). */
export function compareLeastActive(a: StudentRow, b: StudentRow): number {
  if (a.activeDays !== b.activeDays) return a.activeDays - b.activeDays
  if (a.lastActive !== b.lastActive) {
    if (!a.lastActive) return -1
    if (!b.lastActive) return 1
    return a.lastActive < b.lastActive ? -1 : 1
  }
  return a.name.localeCompare(b.name)
}

export function computeStudyActivity(input: {
  students: StudyStudent[]
  quizzes: PracticeQuiz[]
  attempts: QuizAttempt[]
  sessions: FlashcardSession[]
  today: string
  courseStart: string
  range: StudyRange
}): StudyActivity {
  const { students, quizzes, today, courseStart, range } = input
  const from = rangeStart(range, today, courseStart)
  const to = today
  const studentIds = new Set(students.map(s => s.id))
  const quizById = new Map(quizzes.map(q => [q.id, q]))
  const nameById = new Map(students.map(s => [s.id, s.name]))

  const attempts = input.attempts
    .filter(a => studentIds.has(a.studentId) && quizById.has(a.quizId))
    .map(a => ({ ...a, day: pacificDate(a.at) }))
  const sessions = input.sessions
    .filter(s => studentIds.has(s.studentId))
    .map(s => ({ ...s, day: pacificDate(s.at) }))

  // Per student, the days on which each kind of studying happened (all time).
  const quizDays = new Map<string, Set<string>>()
  const cardDays = new Map<string, Set<string>>()
  const add = (m: Map<string, Set<string>>, id: string, day: string) => {
    if (!m.has(id)) m.set(id, new Set())
    m.get(id)!.add(day)
  }
  for (const a of attempts) add(quizDays, a.studentId, a.day)
  for (const s of sessions) add(cardDays, s.studentId, s.day)

  const inRange = (day: string, lo = from, hi = to) => day >= lo && day <= hi
  const activeDaysIn = (id: string, lo: string, hi: string) => {
    const days = new Set<string>()
    for (const d of quizDays.get(id) ?? []) if (inRange(d, lo, hi)) days.add(d)
    for (const d of cardDays.get(id) ?? []) if (inRange(d, lo, hi)) days.add(d)
    return days.size
  }

  const stripStart = addDays(today, -(STRIP_DAYS - 1))
  const quiet7Start = addDays(today, -6)

  const rows: StudentRow[] = students.map(s => {
    const qDays = quizDays.get(s.id) ?? new Set<string>()
    const cDays = cardDays.get(s.id) ?? new Set<string>()
    const myAttempts = attempts.filter(a => a.studentId === s.id)
    const mySessions = sessions.filter(x => x.studentId === s.id)
    const rangeAttempts = myAttempts.filter(a => inRange(a.day))
    const rangeSessions = mySessions.filter(x => inRange(x.day))

    const allTimes = [...myAttempts.map(a => a.at), ...mySessions.map(x => x.at)].sort()
    const strip: StripDay[] = []
    for (let i = 0; i < STRIP_DAYS; i++) {
      const date = addDays(stripStart, i)
      strip.push({ date, quiz: qDays.has(date), cards: cDays.has(date) })
    }

    const byQuiz = new Map<string, StudentQuizSummary>()
    for (const a of rangeAttempts) {
      const cur = byQuiz.get(a.quizId)
      const best = a.score == null ? cur?.best ?? null : Math.max(cur?.best ?? -1, a.score)
      byQuiz.set(a.quizId, {
        quizId: a.quizId,
        title: quizById.get(a.quizId)!.title,
        attempts: (cur?.attempts ?? 0) + 1,
        best,
        lastAt: cur && cur.lastAt > a.at ? cur.lastAt : a.at,
      })
    }

    return {
      id: s.id,
      name: s.name,
      activeDays: activeDaysIn(s.id, from, to),
      quizAttempts: rangeAttempts.length,
      cardsStudied: rangeSessions.reduce((n, x) => n + x.cards, 0),
      flashcardSessions: rangeSessions.length,
      lastActive: allTimes.length ? allTimes[allTimes.length - 1] : null,
      strip,
      quizzes: [...byQuiz.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    }
  })

  // Weekly bars: how many students studied at all in each week the range touches.
  const weeks: WeekBar[] = []
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
    const lo = w < from ? from : w
    const end = addDays(w, 6)
    const hi = end > to ? to : end
    let studied = 0, quizStudents = 0, cardStudents = 0
    for (const s of students) {
      const q = [...(quizDays.get(s.id) ?? [])].some(d => inRange(d, lo, hi))
      const c = [...(cardDays.get(s.id) ?? [])].some(d => inRange(d, lo, hi))
      if (q || c) studied++
      if (q) quizStudents++
      if (c) cardStudents++
    }
    weeks.push({ week: w, studied, quizStudents, cardStudents })
  }

  // Per practice quiz, within the range: who tried it, how often, and first vs best score.
  const quizRows: QuizRow[] = quizzes.map(q => {
    const qa = attempts.filter(a => a.quizId === q.id && inRange(a.day)).sort((a, b) => a.at.localeCompare(b.at))
    const perStudent = new Map<string, { scores: (number | null)[]; lastAt: string }>()
    for (const a of qa) {
      if (!perStudent.has(a.studentId)) perStudent.set(a.studentId, { scores: [], lastAt: a.at })
      const cur = perStudent.get(a.studentId)!
      cur.scores.push(a.score)
      cur.lastAt = a.at
    }
    const firsts: number[] = []
    const bests: number[] = []
    const takers: QuizTaker[] = []
    for (const [studentId, { scores, lastAt }] of perStudent) {
      const scored = scores.filter((x): x is number => x != null)
      const first = scored.length ? scored[0] : null
      const best = scored.length ? Math.max(...scored) : null
      if (first != null && best != null) {
        firsts.push(first)
        bests.push(best)
      }
      takers.push({ studentId, name: nameById.get(studentId)!, attempts: scores.length, first, best, lastAt })
    }
    return {
      quizId: q.id,
      title: q.title,
      moduleTitle: q.moduleTitle,
      students: perStudent.size,
      attempts: qa.length,
      avgFirst: avg(firsts),
      avgBest: avg(bests),
      takers: takers.sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    }
  })

  let studiedPrev: number | null = null
  if (range !== 'all') {
    const len = Number(range)
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(from, -len)
    studiedPrev = prevTo < courseStart ? null : students.filter(s => activeDaysIn(s.id, prevFrom < courseStart ? courseStart : prevFrom, prevTo) > 0).length
  }

  return {
    from,
    to,
    summary: {
      enrolled: students.length,
      studied: rows.filter(r => r.activeDays > 0).length,
      quiet7: students.filter(s => activeDaysIn(s.id, quiet7Start, today) === 0).length,
      medianActiveDays: median(rows.map(r => r.activeDays)),
      studiedPrev,
    },
    students: rows.sort(compareLeastActive),
    weeks,
    quizzes: quizRows,
  }
}

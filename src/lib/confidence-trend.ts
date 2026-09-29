// Pure shaping logic for the Confidence Tracker v2 trend pages (Phase 4). No Supabase or
// React in here so it stays directly unit-testable; the loaders in
// confidence-trend-data.ts fetch the rows and hand them to these functions.

import { STUDY_PLAN_OPTIONS } from '@/lib/confidence-tracker-validation'

export interface RatingRow {
  id: string
  skillId: string
  rating: number
  createdAt: string
  assignmentId: string
}

export interface AssignmentInfo {
  title: string | null
  courseId: string | null
  courseName: string | null
}

export interface GoalRow {
  skillId: string
  goal: number | null
  goalIsMaintain: boolean
  targetDate: string | null
  studyPlan: string[] | null
  studyPlanOther: string | null
  createdAt: string
}

export interface EventRow {
  skillId: string
  eventType: 'mastered' | 'reactivated'
  createdAt: string
}

export interface ProgressRow {
  skillId: string
  isMastered: boolean
  isNewPending: boolean
}

export interface SkillMeta {
  id: string
  name: string
}

export interface TrendRating {
  value: number
  date: string
  assignmentTitle: string | null
  courseId: string | null
  courseName: string | null
  isCurrentCourse: boolean
}

// x is a position on the chart's evenly spaced axis: rating i (0-based) sits at x = i + 1, so a
// marker between two ratings sits at a half step.
export interface TrendMarker {
  x: number
  label: string
}

export interface TrendEvent extends TrendMarker {
  type: 'mastered' | 'reactivated'
  date: string
}

export interface TrendGoal {
  goal: number | null
  isMaintain: boolean
  targetDate: string | null
  studyPlanLabels: string[]
  setAt: string
}

export interface SkillTrend {
  skillId: string
  name: string
  ratings: TrendRating[]
  // The course of the first rating, written at the start of the chart so it's clear what the
  // earliest ratings are for.
  startCourseName: string | null
  courseBreakpoints: TrendMarker[]
  events: TrendEvent[]
  currentGoal: TrendGoal | null
  previousGoals: TrendGoal[]
  isMastered: boolean
  // Mastered at some point but reactivated since — shown in the regular list with a note.
  previouslyMastered: boolean
  masteredDates: string[]
  reactivatedDates: string[]
  // Reactivated and not yet rated again: it will come back as a "new" skill.
  pendingNew: boolean
  latestRating: number | null
}

const byTimeThenId = <T extends { createdAt: string; id?: string }>(a: T, b: T) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (a.id ?? '').localeCompare(b.id ?? '')

const STUDY_PLAN_LABELS: Record<string, string> = Object.fromEntries(
  STUDY_PLAN_OPTIONS.map(o => [o.value, o.label])
)

export function studyPlanLabels(plan: string[] | null, other: string | null): string[] {
  return (plan ?? []).map(value => {
    if (value === 'other') return other ? `Other: ${other}` : 'Other'
    return STUDY_PLAN_LABELS[value] ?? value
  })
}

function toTrendGoal(g: GoalRow): TrendGoal {
  return {
    goal: g.goal,
    isMaintain: g.goalIsMaintain,
    targetDate: g.targetDate,
    studyPlanLabels: studyPlanLabels(g.studyPlan, g.studyPlanOther),
    setAt: g.createdAt,
  }
}

export interface BuildSkillTrendsInput {
  skills: SkillMeta[]
  ratings: RatingRow[]
  assignments: Record<string, AssignmentInfo>
  goals: GoalRow[]
  events: EventRow[]
  progress: ProgressRow[]
  // When set, ratings from this course are flagged isCurrentCourse (instructor page).
  currentCourseId?: string
}

// One student's trends, one entry per skill they have rated at least once.
export function buildSkillTrends(input: BuildSkillTrendsInput): SkillTrend[] {
  const { skills, ratings, assignments, goals, events, progress, currentCourseId } = input
  const trends: SkillTrend[] = []

  for (const skill of skills) {
    const skillRatings = ratings.filter(r => r.skillId === skill.id).sort(byTimeThenId)
    if (skillRatings.length === 0) continue

    const trendRatings: TrendRating[] = skillRatings.map(r => {
      const info = assignments[r.assignmentId]
      return {
        value: r.rating,
        date: r.createdAt,
        assignmentTitle: info?.title ?? null,
        courseId: info?.courseId ?? null,
        courseName: info?.courseName ?? null,
        isCurrentCourse: currentCourseId !== undefined && info?.courseId === currentCourseId,
      }
    })

    const courseBreakpoints: TrendMarker[] = []
    for (let i = 1; i < trendRatings.length; i++) {
      const prev = trendRatings[i - 1]
      const cur = trendRatings[i]
      if (prev.courseId && cur.courseId && prev.courseId !== cur.courseId) {
        // The divider sits between the last rating of the earlier course and the first of the new one.
        courseBreakpoints.push({ x: i + 0.5, label: cur.courseName ?? 'New course' })
      }
    }

    const skillEvents = events
      .filter(e => e.skillId === skill.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    const trendEvents: TrendEvent[] = skillEvents.map(e => {
      const before = skillRatings.filter(r => r.createdAt <= e.createdAt)
      if (e.eventType === 'mastered') {
        // Mastery is reached by the second 10 since the last reactivation, so the marker sits on
        // that rating rather than between two points. It is found from the ratings themselves
        // (not the event's timestamp, which the app clock sets and could sit a moment before the
        // rating it followed); the latest 10 recorded before the event is the fallback.
        const cycleStart = [...skillEvents].reverse().find(x => x.eventType === 'reactivated' && x.createdAt <= e.createdAt)?.createdAt
        const tens = skillRatings.map((r, i) => ({ r, i })).filter(({ r }) => r.rating === 10 && (!cycleStart || r.createdAt > cycleStart))
        const lastTen = before.map(r => r.rating).lastIndexOf(10)
        const idx = tens.length >= 2 ? tens[1].i : lastTen >= 0 ? lastTen : before.length - 1
        return { type: e.eventType, date: e.createdAt, x: Math.max(idx, 0) + 1, label: 'Mastered' }
      }
      // Reactivation isn't tied to a rating: it sits after the ratings recorded before it.
      return { type: e.eventType, date: e.createdAt, x: before.length + 0.5, label: 'Reactivated' }
    })
    const masteredDates = skillEvents.filter(e => e.eventType === 'mastered').map(e => e.createdAt)
    const reactivatedDates = skillEvents.filter(e => e.eventType === 'reactivated').map(e => e.createdAt)
    const lastReactivation = reactivatedDates.length > 0 ? reactivatedDates[reactivatedDates.length - 1] : null

    const skillGoals = goals
      .filter(g => g.skillId === skill.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)) // newest first
    // A goal captured before the latest reactivation is history; only a goal set after it is current.
    const head = skillGoals[0]
    const headIsCurrent = !!head && (!lastReactivation || head.createdAt > lastReactivation)
    const currentGoal = headIsCurrent ? toTrendGoal(head) : null
    const previousGoals = (headIsCurrent ? skillGoals.slice(1) : skillGoals).map(toTrendGoal)

    const prog = progress.find(p => p.skillId === skill.id)
    const isMastered = prog?.isMastered ?? false

    trends.push({
      skillId: skill.id,
      name: skill.name,
      ratings: trendRatings,
      startCourseName: trendRatings[0].courseName,
      courseBreakpoints,
      events: trendEvents,
      currentGoal,
      previousGoals,
      isMastered,
      previouslyMastered: !isMastered && masteredDates.length > 0,
      masteredDates,
      reactivatedDates,
      pendingNew: !isMastered && (prog?.isNewPending ?? false) && reactivatedDates.length > 0,
      latestRating: trendRatings[trendRatings.length - 1].value,
    })
  }

  return trends.sort((a, b) => a.name.localeCompare(b.name))
}

export interface StudentSkillRating {
  id: string
  studentId: string
  skillId: string
  rating: number
  createdAt: string
}

// Each student's most recent rating per skill — "where the class is now".
export function latestRatingsBySkill(rows: StudentSkillRating[]): Record<string, number[]> {
  const latest = new Map<string, StudentSkillRating>()
  for (const r of rows) {
    const key = `${r.studentId}:${r.skillId}`
    const cur = latest.get(key)
    if (!cur || byTimeThenId(cur, r) < 0) latest.set(key, r)
  }
  const bySkill: Record<string, number[]> = {}
  for (const r of latest.values()) (bySkill[r.skillId] ??= []).push(r.rating)
  return bySkill
}

export interface ClassStats {
  n: number
  average: number | null
  median: number | null
  // distribution[i] = how many students' latest rating is i + 1
  distribution: number[]
}

export function computeClassStats(values: number[]): ClassStats {
  const distribution = Array<number>(10).fill(0)
  for (const v of values) if (v >= 1 && v <= 10) distribution[v - 1]++
  if (values.length === 0) return { n: 0, average: null, median: null, distribution }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const average = values.reduce((sum, v) => sum + v, 0) / values.length
  return { n: values.length, average, median, distribution }
}

// A date-only value ('YYYY-MM-DD') parsed as local time, so it never shifts a day in some timezones.
export function formatDateOnly(value: string): string {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// A student's overall standing for sorting: the mean of their latest rating per skill, counting
// only ratings from the course being viewed (earlier-course ratings are context, not standing).
// null when they have no rating from this course.
export function currentCourseScore(trends: SkillTrend[]): number | null {
  const latest: number[] = []
  for (const t of trends) {
    const current = t.ratings.filter(r => r.isCurrentCourse)
    if (current.length > 0) latest.push(current[current.length - 1].value)
  }
  return latest.length === 0 ? null : latest.reduce((sum, v) => sum + v, 0) / latest.length
}

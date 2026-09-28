// Pure, framework-free validation/business-rule helpers for Confidence Tracker v2, Phase 3.
// Deliberately NOT a 'use server' module: a 'use server' file may only export async
// functions, but these are plain synchronous helpers reused by both the server action
// (confidence-tracker-actions.ts) and the client component (ConfidenceRatingPrompt.tsx),
// and are directly unit-tested as pure functions.

const MAX_RATING = 10
const TARGET_DATE_MAX_DAYS_OUT = 14

export const STUDY_PLAN_OPTIONS = [
  { value: 'practice_alone', label: 'Practice on my own (exercises, coding challenges, repetition)' },
  { value: 'review_lessons', label: 'Review the lesson materials again' },
  { value: 'ta_help', label: 'Get help from a TA or instructor' },
  { value: 'outside_tutorials', label: 'Watch outside tutorials or videos' },
  { value: 'flashcards', label: 'Study flashcards' },
  { value: 'review_notes', label: 'Review class notes' },
  { value: 'other', label: 'Other' },
] as const

export type StudyPlan = (typeof STUDY_PLAN_OPTIONS)[number]['value']

const STUDY_PLAN_VALUES = new Set<string>(STUDY_PLAN_OPTIONS.map(o => o.value))

function isStudyPlan(value: unknown): value is StudyPlan {
  return typeof value === 'string' && STUDY_PLAN_VALUES.has(value)
}

export interface ConfidenceGoalInput {
  // 'maintain' is only valid when the paired rating is 10 (the scale max, so no
  // numeric goal above it is possible).
  goal: number | 'maintain'
  targetDate: string // 'YYYY-MM-DD'
  studyPlan: StudyPlan
  studyPlanOther?: string
}

// Per-skill in-progress goal state, shared between ConfidenceRatingPrompt and
// SubmissionForm (and their sessionStorage persistence) — a single source of truth for
// the shape so the two files can't quietly drift.
export interface GoalState {
  goal: number | 'maintain' | null // null = no goal set / cleared
  targetDate: string // '' = unset, else 'YYYY-MM-DD'
  studyPlan: string // '' = unset, else a StudyPlan value
  studyPlanOther: string
}

export interface ValidatedGoal {
  goal: number | null
  goalIsMaintain: boolean
  targetDate: string
  studyPlan: StudyPlan
  studyPlanOther: string | null
}

// The server never trusts client-side validation regardless (defense-in-depth, matching
// this feature's existing isValidRating/tagged-skill checks in confidence-tracker-actions.ts).
export function isValidTargetDate(dateStr: unknown, today: Date = new Date()): boolean {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const parsed = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const maxDate = new Date(startOfToday)
  maxDate.setDate(maxDate.getDate() + TARGET_DATE_MAX_DAYS_OUT)

  return parsed.getTime() > startOfToday.getTime() && parsed.getTime() <= maxDate.getTime()
}

export function validateGoalInput(
  rating: number,
  input: ConfidenceGoalInput | undefined,
  today?: Date
): ValidatedGoal | null {
  if (!input) return null
  if (!isValidTargetDate(input.targetDate, today)) return null
  if (!isStudyPlan(input.studyPlan)) return null

  const studyPlanOther = input.studyPlan === 'other' ? (input.studyPlanOther ?? '').trim() : null
  if (input.studyPlan === 'other' && studyPlanOther === '') return null

  if (rating === MAX_RATING) {
    if (input.goal !== 'maintain') return null
    return { goal: null, goalIsMaintain: true, targetDate: input.targetDate, studyPlan: input.studyPlan, studyPlanOther }
  }

  if (typeof input.goal !== 'number' || !Number.isInteger(input.goal)) return null
  if (input.goal < rating + 1 || input.goal > MAX_RATING) return null

  return { goal: input.goal, goalIsMaintain: false, targetDate: input.targetDate, studyPlan: input.studyPlan, studyPlanOther }
}

export function nextMasteryState(
  priorCount: number,
  priorIsMastered: boolean,
  rating: number
): { tenRatingCount: number; isMastered: boolean; justMastered: boolean } {
  if (priorIsMastered) return { tenRatingCount: priorCount, isMastered: true, justMastered: false }
  if (rating !== MAX_RATING) return { tenRatingCount: priorCount, isMastered: false, justMastered: false }

  const tenRatingCount = priorCount + 1
  const isMastered = tenRatingCount >= 2
  return { tenRatingCount, isMastered, justMastered: isMastered }
}

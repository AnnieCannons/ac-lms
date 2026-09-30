// Pure, framework-free validation/business-rule helpers for Confidence Tracker v2, Phase 3.
// Deliberately NOT a 'use server' module: a 'use server' file may only export async
// functions, but these are plain synchronous helpers reused by both the server action
// (confidence-tracker-actions.ts) and the client component (ConfidenceRatingPrompt.tsx),
// and are directly unit-tested as pure functions.

const MAX_RATING = 10

// Longest "Other" write-in accepted, shared by the study plan and the goal-met "what
// helped" answer so the two stay in step (also enforced by a CHECK on the outcomes table).
export const OTHER_TEXT_MAX_LENGTH = 200

export const STUDY_PLAN_OPTIONS = [
  { value: 'practice_alone', label: 'Practice on my own (re-do assignments, bonus work)' },
  { value: 'review_lessons', label: 'Review the lesson materials again' },
  { value: 'ta_help', label: 'Get help from an Instructor or a TA' },
  { value: 'outside_tutorials', label: 'Watch outside tutorials or videos' },
  { value: 'flashcards', label: 'Study flashcards' },
  { value: 'review_notes', label: 'Review class notes' },
  { value: 'other', label: 'Other' },
] as const

export type StudyPlan = (typeof STUDY_PLAN_OPTIONS)[number]['value']

const STUDY_PLAN_VALUES = new Set<string>(STUDY_PLAN_OPTIONS.map(o => o.value))

function isStudyPlanArray(value: unknown): value is StudyPlan[] {
  return Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string' && STUDY_PLAN_VALUES.has(v))
}

// A numeric goal always carries a target date + study plan(s); "maintaining" a rating
// already at the max isn't working toward anything, so it carries neither. A student may
// select more than one study plan (e.g. flashcards AND TA help), hence the array.
export type ConfidenceGoalInput =
  | { goal: number; targetDate: string; studyPlan: StudyPlan[]; studyPlanOther?: string }
  | { goal: 'maintain' }

// Per-skill in-progress goal state, shared between ConfidenceRatingPrompt and
// SubmissionForm (and their sessionStorage persistence) — a single source of truth for
// the shape so the two files can't quietly drift.
export interface GoalState {
  goal: number | 'maintain' | null // null = no goal set / cleared
  targetDate: string // '' = unset, else 'YYYY-MM-DD'
  studyPlan: string[] // [] = unset, else one or more StudyPlan values
  studyPlanOther: string
}

export interface ValidatedGoal {
  goal: number | null
  goalIsMaintain: boolean
  targetDate: string | null
  studyPlan: StudyPlan[] | null
  studyPlanOther: string | null
}

// The server never trusts client-side validation regardless (defense-in-depth, matching
// this feature's existing isValidRating/tagged-skill checks in confidence-tracker-actions.ts).
export function isValidTargetDate(dateStr: unknown, today: Date = new Date()): boolean {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const parsed = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return parsed.getTime() > startOfToday.getTime()
}

export function validateGoalInput(
  rating: number,
  input: ConfidenceGoalInput | undefined,
  today?: Date
): ValidatedGoal | null {
  if (!input) return null

  if (rating === MAX_RATING) {
    // Maintaining a rating already at the max isn't working toward anything, so no
    // target date/study plan applies (or is accepted) here.
    if (input.goal !== 'maintain') return null
    return { goal: null, goalIsMaintain: true, targetDate: null, studyPlan: null, studyPlanOther: null }
  }

  if (input.goal === 'maintain') return null
  if (!Number.isInteger(input.goal)) return null
  if (input.goal < rating + 1 || input.goal > MAX_RATING) return null
  if (!isValidTargetDate(input.targetDate, today)) return null
  if (!isStudyPlanArray(input.studyPlan)) return null

  const includesOther = input.studyPlan.includes('other')
  const studyPlanOther = includesOther ? (input.studyPlanOther ?? '').trim() : null
  if (includesOther && studyPlanOther === '') return null
  if (studyPlanOther !== null && studyPlanOther.length > OTHER_TEXT_MAX_LENGTH) return null

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

// What helped a student reach a goal (Phase 6). Deliberately mirrors the study-plan values
// (same categories, past tense) so a later phase can line up "planned" with "helped".
export const WHAT_HELPED_OPTIONS = [
  { value: 'practice_alone', label: 'Practicing on my own' },
  { value: 'review_lessons', label: 'Reviewing the lesson materials' },
  { value: 'ta_help', label: 'Getting help from an Instructor or a TA' },
  { value: 'outside_tutorials', label: 'Outside tutorials or videos' },
  { value: 'flashcards', label: 'Studying flashcards' },
  { value: 'review_notes', label: 'Reviewing class notes' },
  { value: 'other', label: 'Other' },
] as const

// The student's own study-plan "Other" text for that goal, offered as one more choice.
export const OWN_PLAN_VALUE = 'own_plan'

const WHAT_HELPED_VALUES = new Set<string>(WHAT_HELPED_OPTIONS.map(o => o.value))

export interface ValidatedWhatHelped {
  whatHelped: string[]
  other: string | null
}

// Returns null for anything invalid: nothing chosen, an unknown value, "own plan" when the
// goal had no write-in, or a blank / too-long "Other".
export function validateWhatHelped(
  selections: unknown,
  otherText: unknown,
  ownPlanText: string | null
): ValidatedWhatHelped | null {
  if (!Array.isArray(selections) || selections.length === 0) return null
  const unique = [...new Set(selections)]
  for (const value of unique) {
    if (typeof value !== 'string') return null
    if (value === OWN_PLAN_VALUE) {
      if (!ownPlanText || ownPlanText.trim() === '') return null
    } else if (!WHAT_HELPED_VALUES.has(value)) {
      return null
    }
  }

  let other: string | null = null
  if (unique.includes('other')) {
    other = typeof otherText === 'string' ? otherText.trim() : ''
    if (other === '' || other.length > OTHER_TEXT_MAX_LENGTH) return null
  }
  return { whatHelped: unique as string[], other }
}

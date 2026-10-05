// Pure, Supabase-free helpers for Confidence Tracker v2 Phase 6 (goal-met and reaching-10
// celebrations). Deliberately not a 'use server' module so these stay directly unit-testable.

import type { KudosItem } from '@/lib/confidence-kudos'

export interface ProgressGoalRow {
  goal: number | null
  goal_is_maintain: boolean
}

// The newest goal_history row for a skill — the student's current goal when their progress
// row still carries a numeric goal.
export interface HeadGoal {
  id: string
  goal: number | null
  goal_is_maintain: boolean
  study_plan: string[] | null
  study_plan_other: string | null
}

export interface MetGoal {
  skillId: string
  rating: number
  goalHistoryId: string
  target: number
  // The student's own study-plan "Other" write-in for that goal, offered as a "what helped" choice.
  ownPlanText: string | null
}

// A goal is met when a rating is equal to or above a numeric goal that hasn't been met yet.
// "Maintaining" goals have no target, so they are never met.
export function findMetGoals(
  entries: { skillId: string; rating: number }[],
  progressBySkill: Map<string, ProgressGoalRow>,
  headGoalBySkill: Map<string, HeadGoal>,
  alreadyMetHistoryIds: Set<string>
): MetGoal[] {
  const met: MetGoal[] = []
  for (const { skillId, rating } of entries) {
    const progress = progressBySkill.get(skillId)
    const head = headGoalBySkill.get(skillId)
    if (!progress || !head) continue
    if (progress.goal_is_maintain || progress.goal == null) continue
    // The history head must be the same goal the progress row holds, otherwise the goal we
    // would mark as met is not the student's current one.
    if (head.goal_is_maintain || head.goal !== progress.goal) continue
    if (alreadyMetHistoryIds.has(head.id)) continue
    if (rating < progress.goal) continue

    const ownPlan = head.study_plan?.includes('other') ? head.study_plan_other?.trim() || null : null
    met.push({ skillId, rating, goalHistoryId: head.id, target: progress.goal, ownPlanText: ownPlan })
  }
  return met
}

export interface CelebrationGoal {
  outcomeId: string
  // null for a return to 10 with no goal: there is no target to name.
  target: number | null
  ownPlanText: string | null
  // Offered only while there is room above the rating, so never at 10.
  nextGoalAllowed: boolean
}

// goal: a numeric goal was reached (asks what helped). returned: a rating below 10 was
// followed by a 10 with no goal met (asks what helped). first: the first-ever rating of a skill
// is a 10 (short, no question).
export type CelebrationKind = 'goal' | 'returned' | 'first'

export interface CelebrationItem {
  skillId: string
  rating: number
  kind: CelebrationKind
  goal?: CelebrationGoal
}

const MAX_RATING = 10

// Skills rated 10 on this submission whose latest earlier rating was lower and that did not meet
// a goal: the student got (back) to 10, which is celebrated and asked about even with no goal.
export function findReturnsToTen(
  entries: { skillId: string; rating: number }[],
  priorBySkill: Map<string, number>,
  metSkillIds: Set<string>
): string[] {
  return entries
    .filter(({ skillId, rating }) => {
      const prior = priorBySkill.get(skillId)
      return rating === MAX_RATING && prior !== undefined && prior < MAX_RATING && !metSkillIds.has(skillId)
    })
    .map(e => e.skillId)
}

// Skills whose first-ever rating on record is a 10.
export function findFirstTens(entries: { skillId: string; rating: number }[], priorBySkill: Map<string, number>): string[] {
  return entries.filter(({ skillId, rating }) => rating === MAX_RATING && !priorBySkill.has(skillId)).map(e => e.skillId)
}

// One item per skill that met a goal or reached 10 on this submission. A met goal wins over a
// plain return to 10, so the question is asked once.
export function buildCelebrations(
  entries: { skillId: string; rating: number }[],
  outcomeIdByHistoryId: Map<string, string>,
  metGoals: MetGoal[],
  returnOutcomeIdBySkill: Map<string, string>,
  firstTenSkillIds: Set<string>
): CelebrationItem[] {
  const metBySkill = new Map(metGoals.map(m => [m.skillId, m]))
  const items: CelebrationItem[] = []
  for (const { skillId, rating } of entries) {
    const met = metBySkill.get(skillId)
    const goalOutcomeId = met ? outcomeIdByHistoryId.get(met.goalHistoryId) : undefined
    if (met && goalOutcomeId) {
      items.push({
        skillId,
        rating,
        kind: 'goal',
        goal: { outcomeId: goalOutcomeId, target: met.target, ownPlanText: met.ownPlanText, nextGoalAllowed: rating < MAX_RATING },
      })
      continue
    }
    const returnOutcomeId = returnOutcomeIdBySkill.get(skillId)
    if (returnOutcomeId) {
      items.push({
        skillId,
        rating,
        kind: 'returned',
        goal: { outcomeId: returnOutcomeId, target: null, ownPlanText: null, nextGoalAllowed: false },
      })
      continue
    }
    if (firstTenSkillIds.has(skillId)) items.push({ skillId, rating, kind: 'first' })
  }
  return items
}

// A celebration replaces the ordinary kudos line for the same skill.
export function withoutCelebrated(kudos: KudosItem[], celebrations: CelebrationItem[]): KudosItem[] {
  const celebrated = new Set(celebrations.map(c => c.skillId))
  return kudos.filter(k => !celebrated.has(k.skillId))
}

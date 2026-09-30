// Pure, Supabase-free helpers for Confidence Tracker v2 Phase 6 (goal-met + mastery
// celebrations). Deliberately not a 'use server' module so these stay directly unit-testable.

import type { KudosItem } from '@/lib/confidence-kudos'

export interface ProgressGoalRow {
  goal: number | null
  goal_is_maintain: boolean
}

// The newest goal_history row for a skill — the student's current goal when their progress
// row still carries a numeric goal (reactivation clears it on the progress row).
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
  target: number
  ownPlanText: string | null
  // Offered only while there is room above the rating; a mastered skill has no goal-setting.
  nextGoalAllowed: boolean
}

export interface CelebrationItem {
  skillId: string
  rating: number
  mastered: boolean
  goal?: CelebrationGoal
}

// One item per skill that met a goal and/or reached mastery on this submission. A rating
// that is both gets a single item (mastered, with the goal attached so the question is asked once).
export function buildCelebrations(
  entries: { skillId: string; rating: number }[],
  outcomeIdByHistoryId: Map<string, string>,
  metGoals: MetGoal[],
  masteredSkillIds: Set<string>
): CelebrationItem[] {
  const metBySkill = new Map(metGoals.map(m => [m.skillId, m]))
  const items: CelebrationItem[] = []
  for (const { skillId, rating } of entries) {
    const met = metBySkill.get(skillId)
    const outcomeId = met ? outcomeIdByHistoryId.get(met.goalHistoryId) : undefined
    const mastered = masteredSkillIds.has(skillId)
    if (!outcomeId && !mastered) continue

    items.push({
      skillId,
      rating,
      mastered,
      ...(met && outcomeId
        ? {
            goal: {
              outcomeId,
              target: met.target,
              ownPlanText: met.ownPlanText,
              nextGoalAllowed: !mastered && rating < 10,
            },
          }
        : {}),
    })
  }
  return items
}

// A celebration replaces the ordinary kudos line for the same skill.
export function withoutCelebrated(kudos: KudosItem[], celebrations: CelebrationItem[]): KudosItem[] {
  const celebrated = new Set(celebrations.map(c => c.skillId))
  return kudos.filter(k => !celebrated.has(k.skillId))
}

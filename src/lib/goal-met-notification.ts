// The bell notification created when a student reaches a goal (Confidence Tracker v2, Phase 6).
// Not a 'use server' module so the type constant and message builder stay plain, shareable values.

export const GOAL_MET_REMINDER_TYPE = 'confidence_goal_what_helped'

export function goalMetReminderMessage(skillName: string, target: number | null): string {
  return target
    ? `You reached your goal of ${target} in ${skillName}. Log what helped.`
    : `You're back at 10 in ${skillName}. Log what helped.`
}

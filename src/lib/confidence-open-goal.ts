// Shared by the submission form's skill list, the rating save and "Set a goal": which of a
// student's skills still have an OPEN goal. Not a 'use server' module (it takes a client).
//
// A skill has an open goal only while its progress row carries a numeric goal whose newest
// goal_history row has no outcome yet (an outcome row is written once the goal is reached). An
// old "maintaining this rating" row (goal_is_maintain, no numeric goal) counts as no goal, so a
// skill that dipped below 10 can be given a new one.

import type { createServerSupabaseClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createServerSupabaseClient>>

export async function findSkillsWithOpenGoal(
  supabase: Client,
  studentId: string,
  progressRows: { skill_id: string; goal: number | null }[]
): Promise<{ error: string | null; skillIds: Set<string> }> {
  const numeric = progressRows.filter(p => p.goal != null).map(p => p.skill_id)
  if (numeric.length === 0) return { error: null, skillIds: new Set() }

  const { data: goalRows, error: goalError } = await supabase
    .from('confidence_tracker_goal_history')
    .select('id, skill_id')
    .eq('student_id', studentId)
    .in('skill_id', numeric)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (goalError) return { error: goalError.message, skillIds: new Set() }

  const headBySkill = new Map<string, string>()
  for (const row of goalRows ?? []) {
    if (!headBySkill.has(row.skill_id)) headBySkill.set(row.skill_id, row.id)
  }

  const metHistoryIds = new Set<string>()
  const headIds = [...headBySkill.values()]
  if (headIds.length > 0) {
    const { data: outcomeRows, error: outcomeError } = await supabase
      .from('confidence_tracker_goal_outcomes')
      .select('goal_history_id')
      .in('goal_history_id', headIds)
    if (outcomeError) return { error: outcomeError.message, skillIds: new Set() }
    for (const o of outcomeRows ?? []) metHistoryIds.add(o.goal_history_id)
  }

  // A numeric goal with no history row should not happen; treat it as open rather than offer a
  // second goal on top of it.
  const open = numeric.filter(skillId => {
    const head = headBySkill.get(skillId)
    return !head || !metHistoryIds.has(head)
  })
  return { error: null, skillIds: new Set(open) }
}

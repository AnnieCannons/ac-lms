'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'

// A student bringing one of their own mastered skills back onto future assignments.
// One guarded UPDATE on their own progress row (the existing RLS UPDATE policy already
// scopes it to student_id = auth.uid()). It restarts the "new skill" flow — count back to
// zero, new-pending again, goal cleared so goal-setting is offered — while every earlier
// goal and the mastery itself stay in the history tables, which the
// record_confidence_tracker_history trigger fills from this same UPDATE.
export async function reactivateConfidenceSkill(skillId: string): Promise<{ error: string | null }> {
  if (!isConfidenceRatingsEnabled()) return { error: 'This feature is not available right now.' }
  if (typeof skillId !== 'string' || !skillId) return { error: 'Missing skill.' }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in.' }

  // Reactivation is about the student's own sense of their confidence. Staff previewing the
  // student view never have mastered rows of their own, but reject them explicitly anyway.
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin' || profile?.role === 'instructor' || profile?.role === 'staff') {
    return { error: 'Staff cannot reactivate skills.' }
  }

  // goal, target date and study plan are cleared in the same statement: the target_date
  // CHECK rejects any UPDATE that leaves a stale past date on the row.
  const { data, error } = await supabase
    .from('confidence_tracker_skill_progress')
    .update({
      is_mastered: false,
      ten_rating_count: 0,
      is_new_pending: true,
      reactivated_at: new Date().toISOString(),
      goal: null,
      goal_is_maintain: false,
      target_date: null,
      study_plan: null,
      study_plan_other: null,
    })
    .eq('student_id', user.id)
    .eq('skill_id', skillId)
    .eq('is_mastered', true)
    .select('id')

  if (error) return { error: "We couldn't reactivate this skill. Please try again." }
  // No row matched: not mastered right now (already reactivated, or never mastered). Harmless.
  if (!data || data.length === 0) return { error: 'This skill is not mastered right now, so there is nothing to reactivate.' }
  return { error: null }
}

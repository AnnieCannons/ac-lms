'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'
import { validateGoalInput, validateWhatHelped, type ConfidenceGoalInput } from '@/lib/confidence-tracker-validation'

// Student-only actions for Phase 6. Same shape as reactivateConfidenceSkill: flag, input,
// auth, reject staff, then only ever touch the caller's own rows. Observers have no ratings
// or progress rows of their own, so the row lookups below find nothing and these are no-ops
// for them too.

const NOT_AVAILABLE = 'This feature is not available right now.'
const NOT_LOGGED_IN = 'You need to be logged in.'

async function getStudentUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isStaff: false }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isStaff = profile?.role === 'admin' || profile?.role === 'instructor' || profile?.role === 'staff'
  return { supabase, user, isStaff }
}

// Saves a student's "what helped" answer for one met goal. Add-only: once answered it is
// never changed, and a repeat (double click, second tab) is a harmless no-op. Answering
// also marks the reminder read (it stays in the bell until cleared or clicked).
export async function answerWhatHelped(
  outcomeId: string,
  selections: string[],
  otherText?: string
): Promise<{ error: string | null }> {
  if (!isConfidenceRatingsEnabled()) return { error: NOT_AVAILABLE }
  if (typeof outcomeId !== 'string' || !outcomeId) return { error: 'Missing goal.' }

  const { user, isStaff } = await getStudentUser()
  if (!user) return { error: NOT_LOGGED_IN }
  if (isStaff) return { error: 'Staff cannot answer for a student.' }

  // The table has no write policies; this service-role client only ever touches rows the
  // explicit student_id checks below tie to the caller.
  const service = createServiceSupabaseClient()
  const { data: outcome } = await service
    .from('confidence_tracker_goal_outcomes')
    .select('id, goal_history_id, answered_at, reminder_notification_id')
    .eq('id', outcomeId)
    .eq('student_id', user.id)
    .maybeSingle()
  if (!outcome) return { error: "We couldn't find that goal." }
  if (outcome.answered_at) return { error: null }

  const { data: goalRow } = await service
    .from('confidence_tracker_goal_history')
    .select('study_plan, study_plan_other')
    .eq('id', outcome.goal_history_id)
    .maybeSingle()
  const ownPlanText = goalRow?.study_plan?.includes('other') ? goalRow.study_plan_other ?? null : null

  const validated = validateWhatHelped(selections, otherText, ownPlanText)
  if (!validated) return { error: 'Please choose at least one option (and fill in "Other" if you pick it).' }

  const { data: updated, error } = await service
    .from('confidence_tracker_goal_outcomes')
    .update({
      what_helped: validated.whatHelped,
      what_helped_other: validated.other,
      answered_at: new Date().toISOString(),
    })
    .eq('id', outcomeId)
    .eq('student_id', user.id)
    .is('answered_at', null)
    .select('id')
  if (error) return { error: "We couldn't save your answer. Please try again." }
  // Zero rows: answered in another tab a moment ago. Nothing more to do.
  if (!updated || updated.length === 0) return { error: null }

  // Answering marks the reminder read. It stays in the bell until the student clears it or clicks it
  // (which opens My Skill Confidence and clears it).
  if (outcome.reminder_notification_id) {
    await service
      .from('notifications')
      .update({ read: true })
      .eq('id', outcome.reminder_notification_id)
      .eq('user_id', user.id)
  }
  return { error: null }
}

// Sets a student's next goal for a skill: allowed when it is not mastered and has no goal
// yet, or its current goal has been met. One guarded UPDATE of the student's own progress
// row; the history trigger then writes the new goal into goal_history beside the earlier
// ones, so nothing is overwritten.
export async function setSkillGoal(skillId: string, goal: ConfidenceGoalInput): Promise<{ error: string | null }> {
  if (!isConfidenceRatingsEnabled()) return { error: NOT_AVAILABLE }
  if (typeof skillId !== 'string' || !skillId) return { error: 'Missing skill.' }

  const { supabase, user, isStaff } = await getStudentUser()
  if (!user) return { error: NOT_LOGGED_IN }
  if (isStaff) return { error: 'Staff cannot set goals for a student.' }

  const { data: progress } = await supabase
    .from('confidence_tracker_skill_progress')
    .select('goal, goal_is_maintain, is_mastered, is_new_pending, updated_at')
    .eq('student_id', user.id)
    .eq('skill_id', skillId)
    .maybeSingle()
  if (!progress) return { error: 'Rate this skill on an assignment first, then you can set a goal.' }
  if (progress.is_mastered) return { error: 'This skill is mastered, so there is no goal to set.' }
  // Reactivated and not rated again yet: it comes back as a new skill, and a goal is set then.
  if (progress.is_new_pending) return { error: "You'll set a goal the next time you rate this skill." }
  if (progress.goal_is_maintain) return { error: "You're already maintaining this rating." }

  if (progress.goal != null) {
    // A numeric goal exists: a new one is only allowed once it has been met.
    const { data: head } = await supabase
      .from('confidence_tracker_goal_history')
      .select('id')
      .eq('student_id', user.id)
      .eq('skill_id', skillId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: met } = head
      ? await supabase.from('confidence_tracker_goal_outcomes').select('id').eq('goal_history_id', head.id).maybeSingle()
      : { data: null }
    if (!met) return { error: 'You already have a goal in progress for this skill.' }
  }

  const { data: latest } = await supabase
    .from('confidence_tracker_ratings')
    .select('rating')
    .eq('student_id', user.id)
    .eq('skill_id', skillId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return { error: 'Rate this skill on an assignment first, then you can set a goal.' }

  const validated = validateGoalInput(latest.rating, goal)
  if (!validated || validated.goalIsMaintain) {
    return { error: 'Please check your goal, target date and study plan.' }
  }

  // updated_at guards a double click or second tab: the first write changes it, so a second
  // identical call matches nothing and is a harmless no-op.
  const { data: updated, error } = await supabase
    .from('confidence_tracker_skill_progress')
    .update({
      goal: validated.goal,
      goal_is_maintain: false,
      target_date: validated.targetDate,
      study_plan: validated.studyPlan,
      study_plan_other: validated.studyPlanOther,
    })
    .eq('student_id', user.id)
    .eq('skill_id', skillId)
    .eq('is_mastered', false)
    .eq('updated_at', progress.updated_at)
    .select('id')
  if (error) return { error: "We couldn't save your goal. Please try again." }
  // Zero rows: it was just saved from another tab or click — nothing more to do.
  void updated
  return { error: null }
}

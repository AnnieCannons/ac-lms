'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { listAssignmentSkills, type ConfidenceSkill } from '@/lib/skill-actions'
import { validateGoalInput, type ConfidenceGoalInput } from '@/lib/confidence-tracker-validation'
import { computeKudos, latestPriorRatingBySkill, type KudosItem } from '@/lib/confidence-kudos'
import {
  buildCelebrations,
  findFirstTens,
  findMetGoals,
  findReturnsToTen,
  withoutCelebrated,
  type CelebrationItem,
  type HeadGoal,
} from '@/lib/confidence-celebrations'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'
import { GOAL_MET_REMINDER_TYPE, goalMetReminderMessage } from '@/lib/goal-met-notification'
import { findSkillsWithOpenGoal } from '@/lib/confidence-open-goal'

const MIN_RATING = 1
const MAX_RATING = 10

function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING
}

export interface ConfidenceRatingInput {
  skillId: string
  rating: number
  // Only honored server-side while this skill has no open goal (see findSkillsWithOpenGoal): a goal
  // already in progress is never overwritten by a later rating.
  goal?: ConfidenceGoalInput
}

export interface ConfidenceSkillWithStatus extends ConfidenceSkill {
  // True only when this student has NEVER rated this skill before (no earlier rating on any
  // assignment) — drives the "New" badge. Independent of canSetGoal: a skipped goal on that first
  // rating means the badge stops showing on later occasions, but goal-setting is still offered.
  isNew: boolean
  // The student's latest rating of this skill is 10, so it is "maintaining": the form shows it in a
  // collapsed row, already at 10, and saves nothing for it unless the student changes the rating.
  isMaintaining: boolean
  // True while this skill has no open goal — never had one, or the last one was reached — so the
  // goal-setting section appears once a rating below 10 is picked. Stays true across many occasions
  // if the student keeps skipping it.
  canSetGoal: boolean
}

interface SkillProgressRow {
  skill_id: string
  goal: number | null
  goal_is_maintain: boolean
  target_date: string | null
  study_plan: string[] | null
  study_plan_other: string | null
}

// Server-side resolution for a student's view of an assignment's tagged skills: every tagged skill
// is returned (a skill at 10 is shown as maintaining, never hidden), with whether it is new to the
// student, whether it is maintaining, and whether a goal can be set on it.
export async function getAssignmentSkillsForStudent(
  assignmentId: string
): Promise<{ error: string | null; skills: ConfidenceSkillWithStatus[] }> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', skills: [] }

  const { error: taggedError, skills: tagged } = await listAssignmentSkills(assignmentId)
  if (taggedError) return { error: taggedError, skills: [] }
  if (tagged.length === 0) return { error: null, skills: [] }

  const { data: progressRows, error: progressError } = await supabase
    .from('confidence_tracker_skill_progress')
    .select('skill_id, goal')
    .eq('student_id', user.id)
    .in('skill_id', tagged.map(s => s.id))
  if (progressError) return { error: progressError.message, skills: [] }

  const { error: openGoalError, skillIds: openGoalSkillIds } = await findSkillsWithOpenGoal(supabase, user.id, progressRows ?? [])
  if (openGoalError) return { error: openGoalError, skills: [] }

  // "New" badge = no earlier rating of this skill at all; "maintaining" = the latest rating is 10.
  // Both come from the ratings themselves, newest first.
  const { data: ratedRows, error: ratedError } = await supabase
    .from('confidence_tracker_ratings')
    .select('skill_id, rating')
    .eq('student_id', user.id)
    .in('skill_id', tagged.map(s => s.id))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (ratedError) return { error: ratedError.message, skills: [] }
  const latestRating = new Map<string, number>()
  for (const r of ratedRows ?? []) if (!latestRating.has(r.skill_id)) latestRating.set(r.skill_id, r.rating)

  return {
    error: null,
    skills: tagged.map(s => ({
      ...s,
      isNew: !latestRating.has(s.id),
      isMaintaining: latestRating.get(s.id) === MAX_RATING,
      canSetGoal: !openGoalSkillIds.has(s.id),
    })),
  }
}

// Phase 6: decides which rated skills earn a celebration, and records each one that asks "what
// helped" (one outcome row per met goal, guaranteed once by a unique key; one per return to 10 with
// no goal) so it can be asked about and reminded of later. Best-effort like kudos — the caller never
// fails a good save because of this. Reads use the student's own client (RLS); the outcome inserts
// use the service client because the table deliberately has no write policies.
async function recordCelebrations(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  assignmentId: string,
  candidates: { skillId: string; rating: number }[],
  progressBySkill: Map<string, SkillProgressRow>,
  priorBySkill: Map<string, number> | null
): Promise<CelebrationItem[]> {
  const skillIds = candidates.map(c => c.skillId)
  const outcomeIdByHistoryId = new Map<string, string>()
  const returnOutcomeIdBySkill = new Map<string, string>()
  let metGoals: ReturnType<typeof findMetGoals> = []
  // Without the earlier ratings (their read failed) a first 10 can't be told from a return to 10.
  const firstTenSkillIds = new Set(priorBySkill ? findFirstTens(candidates, priorBySkill) : [])

  try {
    // The newest goal_history row per skill is the student's current goal (the progress row
    // can't say which history row it is). Read before the upsert, so a goal set on THIS
    // submission can never count as met by it.
    const { data: goalRows, error: goalError } = await supabase
      .from('confidence_tracker_goal_history')
      .select('id, skill_id, goal, goal_is_maintain, study_plan, study_plan_other')
      .eq('student_id', userId)
      .in('skill_id', skillIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (goalError) throw goalError

    const headGoalBySkill = new Map<string, HeadGoal>()
    for (const row of goalRows ?? []) {
      if (!headGoalBySkill.has(row.skill_id)) headGoalBySkill.set(row.skill_id, row)
    }

    const headIds = [...headGoalBySkill.values()].map(h => h.id)
    const alreadyMet = new Set<string>()
    if (headIds.length > 0) {
      const { data: outcomeRows, error: outcomeError } = await supabase
        .from('confidence_tracker_goal_outcomes')
        .select('goal_history_id')
        .in('goal_history_id', headIds)
      if (outcomeError) throw outcomeError
      for (const o of outcomeRows ?? []) alreadyMet.add(o.goal_history_id)
    }

    metGoals = findMetGoals(candidates, progressBySkill, headGoalBySkill, alreadyMet)
    const returnSkillIds = priorBySkill ? findReturnsToTen(candidates, priorBySkill, new Set(metGoals.map(m => m.skillId))) : []

    if (metGoals.length > 0 || returnSkillIds.length > 0) {
      const service = createServiceSupabaseClient()

      if (metGoals.length > 0) {
        // ignoreDuplicates: a goal already met (or a double call) inserts nothing and is not celebrated.
        const { data: inserted, error: insertOutcomeError } = await service
          .from('confidence_tracker_goal_outcomes')
          .upsert(
            metGoals.map(m => ({
              goal_history_id: m.goalHistoryId,
              student_id: userId,
              skill_id: m.skillId,
              met_rating: m.rating,
              met_assignment_id: assignmentId,
            })),
            { onConflict: 'goal_history_id', ignoreDuplicates: true }
          )
          .select('id, goal_history_id')
        if (insertOutcomeError) throw insertOutcomeError
        for (const row of inserted ?? []) outcomeIdByHistoryId.set(row.goal_history_id, row.id)
      }

      // A return to 10 with no goal has no goal_history row to hang the outcome on. It is one-time per
      // assignment because a student's first submission is the only occasion ratings are saved.
      if (returnSkillIds.length > 0) {
        const { data: insertedReturns, error: insertReturnError } = await service
          .from('confidence_tracker_goal_outcomes')
          .insert(
            returnSkillIds.map(skillId => ({
              goal_history_id: null,
              student_id: userId,
              skill_id: skillId,
              met_rating: 10,
              met_assignment_id: assignmentId,
            }))
          )
          .select('id, skill_id')
        if (insertReturnError) throw insertReturnError
        for (const row of insertedReturns ?? []) returnOutcomeIdBySkill.set(row.skill_id, row.id)
      }

      // The "log what helped" reminder goes into the bell right away and stays there until the question
      // is answered or the student clears it. Best-effort on its own: the celebration doesn't depend on it.
      try {
        const reminders: { outcomeId: string; skillId: string; target: number | null }[] = [
          ...metGoals
            .filter(m => outcomeIdByHistoryId.has(m.goalHistoryId))
            .map(m => ({ outcomeId: outcomeIdByHistoryId.get(m.goalHistoryId)!, skillId: m.skillId, target: m.target })),
          ...[...returnOutcomeIdBySkill].map(([skillId, outcomeId]) => ({ outcomeId, skillId, target: null })),
        ]
        if (reminders.length > 0) {
          const { data: skillRows } = await service
            .from('confidence_tracker_skills')
            .select('id, name')
            .in('id', reminders.map(r => r.skillId))
          const skillName = new Map((skillRows ?? []).map(s => [s.id, s.name as string]))
          for (const r of reminders) {
            const { data: notification } = await service
              .from('notifications')
              .insert({
                user_id: userId,
                type: GOAL_MET_REMINDER_TYPE,
                message: goalMetReminderMessage(skillName.get(r.skillId) ?? 'this skill', r.target),
              })
              .select('id')
              .single()
            if (notification) {
              await service
                .from('confidence_tracker_goal_outcomes')
                .update({ reminder_notification_id: notification.id })
                .eq('id', r.outcomeId)
            }
          }
        }
      } catch {
        // No reminder this time; the follow-up on My Skill Confidence still lists the goal.
      }
    }
  } catch {
    // Skip the "what helped" celebrations; a first 10 needs none of the above.
    metGoals = []
    outcomeIdByHistoryId.clear()
    returnOutcomeIdBySkill.clear()
  }

  return buildCelebrations(candidates, outcomeIdByHistoryId, metGoals, returnOutcomeIdBySkill, firstTenSkillIds)
}

export async function saveConfidenceRatings(
  assignmentId: string,
  ratings: ConfidenceRatingInput[]
): Promise<{ error: string | null; kudos?: KudosItem[]; celebrations?: CelebrationItem[] }> {
  const valid = ratings.filter(r => isValidRating(r.rating))
  if (valid.length === 0) return { error: null }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // At most one rating-capture event per student per assignment, ever — if any rating
  // already exists here, this isn't the student's first submission anymore (or a
  // duplicate call), so silently no-op rather than error or backfill skipped skills.
  const { data: existing, error: existingError } = await supabase
    .from('confidence_tracker_ratings')
    .select('id')
    .eq('student_id', user.id)
    .eq('assignment_id', assignmentId)
    .limit(1)
  if (existingError) return { error: existingError.message }
  if (existing && existing.length > 0) return { error: null }

  const { data: taggedSkills, error: taggedError } = await supabase
    .from('confidence_tracker_assignment_skills')
    .select('skill_id')
    .eq('assignment_id', assignmentId)
  if (taggedError) return { error: taggedError.message }

  const taggedSkillIds = new Set((taggedSkills ?? []).map(s => s.skill_id))
  const candidates = valid.filter(r => taggedSkillIds.has(r.skillId))
  if (candidates.length === 0) return { error: null }

  const { data: progressRows, error: progressError } = await supabase
    .from('confidence_tracker_skill_progress')
    .select('skill_id, goal, goal_is_maintain, target_date, study_plan, study_plan_other')
    .eq('student_id', user.id)
    .in('skill_id', candidates.map(c => c.skillId))
  if (progressError) return { error: progressError.message }

  const progressBySkill = new Map<string, SkillProgressRow>((progressRows ?? []).map(p => [p.skill_id, p]))

  const { error: openGoalError, skillIds: openGoalSkillIds } = await findSkillsWithOpenGoal(supabase, user.id, progressRows ?? [])
  if (openGoalError) return { error: openGoalError }

  // Phase 5 kudos: read the student's earlier ratings BEFORE inserting this submission's.
  // Best-effort — if this read fails we just skip kudos rather than fail a good save.
  const { data: priorRows, error: priorError } = await supabase
    .from('confidence_tracker_ratings')
    .select('id, skill_id, rating, created_at')
    .eq('student_id', user.id)
    .in('skill_id', candidates.map(c => c.skillId))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const rows = candidates.map(c => ({
    student_id: user.id,
    assignment_id: assignmentId,
    skill_id: c.skillId,
    rating: c.rating,
  }))
  const { error: insertError } = await supabase.from('confidence_tracker_ratings').insert(rows)
  if (insertError) return { error: insertError.message }

  const progressUpserts = candidates.map(c => {
    const row = progressBySkill.get(c.skillId)
    // A goal can be set on ANY occasion the skill has no open goal — not just its first-ever ("new")
    // rating, and again after a goal was reached or a rating dropped below 10. A goal still in
    // progress is never overwritten by a later rating.
    const canSetGoal = !openGoalSkillIds.has(c.skillId)
    const validated = canSetGoal ? validateGoalInput(c.rating, c.goal) : null

    return {
      student_id: user.id,
      skill_id: c.skillId,
      is_new_pending: false,
      goal: validated ? validated.goal : row?.goal ?? null,
      // A new goal replaces any old "maintaining this rating" marker, which the table does not allow beside a goal.
      goal_is_maintain: validated ? false : row?.goal_is_maintain ?? false,
      target_date: validated ? validated.targetDate : row?.target_date ?? null,
      study_plan: validated ? validated.studyPlan : row?.study_plan ?? null,
      study_plan_other: validated ? validated.studyPlanOther : row?.study_plan_other ?? null,
    }
  })

  const { error: progressUpsertError } = await supabase
    .from('confidence_tracker_skill_progress')
    .upsert(progressUpserts, { onConflict: 'student_id,skill_id' })
  if (progressUpsertError) return { error: progressUpsertError.message }

  // Kudos and celebrations are computed here; the flag only withholds them (ratings above are
  // saved either way, and with the flag off no goal outcome is recorded at all). A celebration
  // replaces the ordinary kudos line for the same skill, so a rise to 10 shows one message.
  const flagEnabled = isConfidenceRatingsEnabled()
  const priorBySkill = priorError ? null : latestPriorRatingBySkill(priorRows ?? [])
  const kudos = flagEnabled && priorBySkill ? computeKudos(candidates, priorBySkill) : []
  const celebrations = flagEnabled
    ? await recordCelebrations(supabase, user.id, assignmentId, candidates, progressBySkill, priorBySkill)
    : []
  return { error: null, kudos: withoutCelebrated(kudos, celebrations), celebrations }
}

'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { listAssignmentSkills, type ConfidenceSkill } from '@/lib/skill-actions'
import { validateGoalInput, nextMasteryState, type ConfidenceGoalInput } from '@/lib/confidence-tracker-validation'
import { computeKudos, latestPriorRatingBySkill, type KudosItem } from '@/lib/confidence-kudos'
import {
  buildCelebrations,
  findMetGoals,
  withoutCelebrated,
  type CelebrationItem,
  type HeadGoal,
} from '@/lib/confidence-celebrations'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'
import { GOAL_MET_REMINDER_TYPE, goalMetReminderMessage } from '@/lib/goal-met-notification'

const MIN_RATING = 1
const MAX_RATING = 10

function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING
}

export interface ConfidenceRatingInput {
  skillId: string
  rating: number
  // Only honored server-side while this skill still has no goal captured yet (see
  // canSetGoal below) — once a goal (numeric or "maintaining") is set, it's permanent.
  goal?: ConfidenceGoalInput
}

export interface ConfidenceSkillWithStatus extends ConfidenceSkill {
  // True only when this student has NEVER rated this skill before (no earlier rating on any
  // assignment) — drives the "New" badge. A reactivated skill is not new: it has earlier ratings, so
  // no badge, even though reactivation (is_new_pending on the progress row) still restarts goal-setting,
  // skips kudos on its next rating, and shows "You'll set a new goal…" on My Skill Confidence.
  // Independent of canSetGoal: a skipped goal on that first rating means the badge stops showing on
  // later occasions, but goal-setting is still offered.
  isNew: boolean
  // True as long as no goal (numeric or "maintaining") has been captured for this skill
  // yet — drives whether the goal-setting section appears. Stays true across many
  // occasions if the student keeps skipping it, false forever once a goal is set.
  canSetGoal: boolean
}

interface SkillProgressRow {
  skill_id: string
  is_new_pending: boolean
  goal: number | null
  goal_is_maintain: boolean
  target_date: string | null
  study_plan: string[] | null
  study_plan_other: string | null
  ten_rating_count: number
  is_mastered: boolean
  mastered_at: string | null
}

// Server-side "new vs. existing vs. mastered" resolution for a student's view of an
// assignment's tagged skills. Mastered skills are excluded here, not just hidden in the
// UI — mirrors the "resources.instructor_only filtered server-side" invariant elsewhere
// in this app; never rely on the client to hide a mastered skill.
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
    .select('skill_id, is_new_pending, goal, goal_is_maintain, is_mastered')
    .eq('student_id', user.id)
    .in('skill_id', tagged.map(s => s.id))
  if (progressError) return { error: progressError.message, skills: [] }

  // "New" badge = no earlier rating of this skill at all. Read from the ratings themselves rather than the
  // progress row, because a reactivated skill has a progress row flagged new-pending but real earlier ratings.
  const { data: ratedRows, error: ratedError } = await supabase
    .from('confidence_tracker_ratings')
    .select('skill_id')
    .eq('student_id', user.id)
    .in('skill_id', tagged.map(s => s.id))
  if (ratedError) return { error: ratedError.message, skills: [] }
  const everRated = new Set((ratedRows ?? []).map(r => r.skill_id))

  const progressBySkill = new Map((progressRows ?? []).map(p => [p.skill_id, p]))
  return {
    error: null,
    skills: tagged
      .filter(s => !progressBySkill.get(s.id)?.is_mastered)
      .map(s => {
        const progress = progressBySkill.get(s.id)
        return {
          ...s,
          isNew: !everRated.has(s.id),
          canSetGoal: !progress || (progress.goal == null && !progress.goal_is_maintain),
        }
      }),
  }
}

// Phase 6: decides which rated skills earn a goal-met and/or mastery celebration, and records
// each newly met goal (one outcome row per goal, guaranteed once by a unique key) so it can be
// asked about and reminded of later. Best-effort like kudos — the caller never fails a good
// save because of this. Reads use the student's own client (RLS); the outcome insert uses the
// service client because the table deliberately has no write policies.
async function recordCelebrations(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  assignmentId: string,
  candidates: { skillId: string; rating: number }[],
  progressBySkill: Map<string, SkillProgressRow>,
  masteredSkillIds: Set<string>
): Promise<CelebrationItem[]> {
  const skillIds = candidates.map(c => c.skillId)
  const outcomeIdByHistoryId = new Map<string, string>()
  let metGoals: ReturnType<typeof findMetGoals> = []

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

    if (metGoals.length > 0) {
      const service = createServiceSupabaseClient()

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

      // The "log what helped" reminder goes into the bell right away and stays there until the question
      // is answered or the student clears it. Best-effort on its own: the celebration doesn't depend on it.
      try {
        const newlyMet = metGoals.filter(m => outcomeIdByHistoryId.has(m.goalHistoryId))
        if (newlyMet.length > 0) {
          const { data: skillRows } = await service
            .from('confidence_tracker_skills')
            .select('id, name')
            .in('id', newlyMet.map(m => m.skillId))
          const skillName = new Map((skillRows ?? []).map(s => [s.id, s.name as string]))
          for (const m of newlyMet) {
            const { data: notification } = await service
              .from('notifications')
              .insert({
                user_id: userId,
                type: GOAL_MET_REMINDER_TYPE,
                message: goalMetReminderMessage(skillName.get(m.skillId) ?? 'this skill', m.target),
              })
              .select('id')
              .single()
            if (notification) {
              await service
                .from('confidence_tracker_goal_outcomes')
                .update({ reminder_notification_id: notification.id })
                .eq('id', outcomeIdByHistoryId.get(m.goalHistoryId)!)
            }
          }
        }
      } catch {
        // No reminder this time; the follow-up on My Skill Confidence still lists the goal.
      }
    }
  } catch {
    // Skip the goal-met part; mastery celebrations need none of the above.
    metGoals = []
    outcomeIdByHistoryId.clear()
  }

  return buildCelebrations(candidates, outcomeIdByHistoryId, metGoals, masteredSkillIds)
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
  let candidates = valid.filter(r => taggedSkillIds.has(r.skillId))
  if (candidates.length === 0) return { error: null }

  const { data: progressRows, error: progressError } = await supabase
    .from('confidence_tracker_skill_progress')
    .select(
      'skill_id, is_new_pending, goal, goal_is_maintain, target_date, study_plan, study_plan_other, ten_rating_count, is_mastered, mastered_at'
    )
    .eq('student_id', user.id)
    .in('skill_id', candidates.map(c => c.skillId))
  if (progressError) return { error: progressError.message }

  const progressBySkill = new Map<string, SkillProgressRow>((progressRows ?? []).map(p => [p.skill_id, p]))

  // Server-side mastery gate — never trust the client's rendered list (an instructor may
  // keep a mastered skill tagged, or a stale page could resend it).
  candidates = candidates.filter(c => !progressBySkill.get(c.skillId)?.is_mastered)
  if (candidates.length === 0) return { error: null }

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

  const masteredSkillIds = new Set<string>()
  const progressUpserts = candidates.map(c => {
    const row = progressBySkill.get(c.skillId)
    const { tenRatingCount, isMastered, justMastered } = nextMasteryState(
      row?.ten_rating_count ?? 0,
      row?.is_mastered ?? false,
      c.rating
    )
    if (justMastered) masteredSkillIds.add(c.skillId)
    // A goal can be set on ANY occasion the skill still has none captured yet — not just
    // its first-ever ("new") rating. Once a goal (numeric or "maintaining") exists, it's
    // permanent: a later rating must never overwrite it.
    const canSetGoal = !row || (row.goal == null && !row.goal_is_maintain)
    const validated = canSetGoal ? validateGoalInput(c.rating, c.goal) : null

    return {
      student_id: user.id,
      skill_id: c.skillId,
      is_new_pending: false,
      goal: validated ? validated.goal : row?.goal ?? null,
      goal_is_maintain: validated ? validated.goalIsMaintain : row?.goal_is_maintain ?? false,
      target_date: validated ? validated.targetDate : row?.target_date ?? null,
      study_plan: validated ? validated.studyPlan : row?.study_plan ?? null,
      study_plan_other: validated ? validated.studyPlanOther : row?.study_plan_other ?? null,
      ten_rating_count: tenRatingCount,
      is_mastered: isMastered,
      mastered_at: justMastered ? new Date().toISOString() : row?.mastered_at ?? null,
    }
  })

  const { error: progressUpsertError } = await supabase
    .from('confidence_tracker_skill_progress')
    .upsert(progressUpserts, { onConflict: 'student_id,skill_id' })
  if (progressUpsertError) return { error: progressUpsertError.message }

  // Kudos and celebrations are computed here; the flag only withholds them (ratings above are
  // saved either way, and with the flag off no goal outcome is recorded at all). A celebration
  // replaces the ordinary kudos line for the same skill.
  const flagEnabled = isConfidenceRatingsEnabled()
  const kudos =
    flagEnabled && !priorError
      ? computeKudos(candidates, latestPriorRatingBySkill(priorRows ?? []), progressBySkill)
      : []
  const celebrations = flagEnabled
    ? await recordCelebrations(supabase, user.id, assignmentId, candidates, progressBySkill, masteredSkillIds)
    : []
  return { error: null, kudos: withoutCelebrated(kudos, celebrations), celebrations }
}

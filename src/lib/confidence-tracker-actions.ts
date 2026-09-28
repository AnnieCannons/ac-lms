'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { listAssignmentSkills, type ConfidenceSkill } from '@/lib/skill-actions'
import { validateGoalInput, nextMasteryState, type ConfidenceGoalInput } from '@/lib/confidence-tracker-validation'

const MIN_RATING = 1
const MAX_RATING = 10

function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING
}

export interface ConfidenceRatingInput {
  skillId: string
  rating: number
  // Only honored server-side if this skill is still "new" (is_new_pending) for the
  // student — a goal can only be set the moment a skill's first-ever rating happens.
  goal?: ConfidenceGoalInput
}

export interface ConfidenceSkillWithStatus extends ConfidenceSkill {
  isNew: boolean
}

interface SkillProgressRow {
  skill_id: string
  is_new_pending: boolean
  goal: number | null
  goal_is_maintain: boolean
  target_date: string | null
  study_plan: string | null
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
    .select('skill_id, is_new_pending, is_mastered')
    .eq('student_id', user.id)
    .in('skill_id', tagged.map(s => s.id))
  if (progressError) return { error: progressError.message, skills: [] }

  const progressBySkill = new Map((progressRows ?? []).map(p => [p.skill_id, p]))
  return {
    error: null,
    skills: tagged
      .filter(s => !progressBySkill.get(s.id)?.is_mastered)
      .map(s => ({ ...s, isNew: progressBySkill.get(s.id)?.is_new_pending ?? true })),
  }
}

export async function saveConfidenceRatings(
  assignmentId: string,
  ratings: ConfidenceRatingInput[]
): Promise<{ error: string | null }> {
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
    const wasNew = row?.is_new_pending ?? true
    const { tenRatingCount, isMastered, justMastered } = nextMasteryState(
      row?.ten_rating_count ?? 0,
      row?.is_mastered ?? false,
      c.rating
    )
    // Only a skill's first-ever ("new") rating can set/change a goal — a later plain
    // rating on an already-rated skill must never overwrite whatever goal was captured
    // the first time.
    const validated = wasNew ? validateGoalInput(c.rating, c.goal) : null

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

  return { error: null }
}

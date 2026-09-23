'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

const MIN_RATING = 1
const MAX_RATING = 10

function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING
}

export interface ConfidenceRatingInput {
  skillId: string
  rating: number
}

export async function saveConfidenceRatings(
  assignmentId: string,
  ratings: ConfidenceRatingInput[]
): Promise<{ error: string | null }> {
  const valid = ratings.filter(r => isValidRating(r.rating))
  if (valid.length === 0) return { error: null }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
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
  const rows = valid
    .filter(r => taggedSkillIds.has(r.skillId))
    .map(r => ({ student_id: user.id, assignment_id: assignmentId, skill_id: r.skillId, rating: r.rating }))
  if (rows.length === 0) return { error: null }

  const { error } = await supabase.from('confidence_tracker_ratings').insert(rows)
  if (error) return { error: error.message }
  return { error: null }
}

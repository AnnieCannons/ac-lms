'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeSkillName } from '@/lib/skill-normalize'

export interface ConfidenceSkill {
  id: string
  name: string
}

async function requireConfidenceSkillAccess() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !['admin', 'instructor', 'staff'].includes(profile.role)) {
    return { error: 'Only instructors, staff, or admins can manage confidence skills.' as const, supabase: null }
  }

  return { error: null, supabase }
}

export async function listSkills(): Promise<{ error: string | null; skills: ConfidenceSkill[] }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('confidence_tracker_skills')
    .select('id, name')
    .order('name')
  if (error) return { error: error.message, skills: [] }
  return { error: null, skills: data ?? [] }
}

export async function listAssignmentSkills(assignmentId: string): Promise<{ error: string | null; skills: ConfidenceSkill[] }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('confidence_tracker_assignment_skills')
    .select('confidence_tracker_skills (id, name)')
    .eq('assignment_id', assignmentId)
  if (error) return { error: error.message, skills: [] }
  // Without generated Supabase Database types, the client can't statically know
  // this embedded relation is many-to-one — handle both possible shapes at runtime.
  type EmbeddedRow = { confidence_tracker_skills: ConfidenceSkill | ConfidenceSkill[] | null }
  const skills = ((data ?? []) as unknown as EmbeddedRow[])
    .map(row => Array.isArray(row.confidence_tracker_skills) ? row.confidence_tracker_skills[0] : row.confidence_tracker_skills)
    .filter((s): s is ConfidenceSkill => s != null)
  return { error: null, skills }
}

export async function createSkill(name: string): Promise<{ error: string | null; skill: ConfidenceSkill | null }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Skill name cannot be empty.', skill: null }

  const { error: accessError, supabase } = await requireConfidenceSkillAccess()
  if (accessError || !supabase) return { error: accessError, skill: null }

  const normalized = normalizeSkillName(trimmed)
  if (!normalized) return { error: 'Skill name cannot be empty.', skill: null }

  const { data: existing } = await supabase
    .from('confidence_tracker_skills')
    .select('id, name')
    .eq('normalized_name', normalized)
    .maybeSingle()
  if (existing) return { error: null, skill: existing }

  const { data, error } = await supabase
    .from('confidence_tracker_skills')
    .insert({ name: trimmed, normalized_name: normalized })
    .select('id, name')
    .single()

  // Race: another instructor created the same normalized skill between our
  // check and insert — the UNIQUE constraint rejects it, so fetch theirs instead.
  if (error?.code === '23505') {
    const { data: raceWinner } = await supabase
      .from('confidence_tracker_skills')
      .select('id, name')
      .eq('normalized_name', normalized)
      .single()
    if (raceWinner) return { error: null, skill: raceWinner }
  }
  if (error) return { error: error.message, skill: null }
  return { error: null, skill: data }
}

export async function renameSkill(skillId: string, newName: string): Promise<{ error: string | null }> {
  const trimmed = newName.trim()
  if (!trimmed) return { error: 'Skill name cannot be empty.' }

  const { error: accessError, supabase } = await requireConfidenceSkillAccess()
  if (accessError || !supabase) return { error: accessError }

  const normalized = normalizeSkillName(trimmed)
  if (!normalized) return { error: 'Skill name cannot be empty.' }

  const { error } = await supabase
    .from('confidence_tracker_skills')
    .update({ name: trimmed, normalized_name: normalized })
    .eq('id', skillId)
  if (error?.code === '23505') return { error: 'Another skill already has this name.' }
  if (error) return { error: error.message }
  return { error: null }
}

export async function setAssignmentSkills(assignmentId: string, skillIds: string[]): Promise<{ error: string | null }> {
  const { error: accessError, supabase } = await requireConfidenceSkillAccess()
  if (accessError || !supabase) return { error: accessError }

  const { data: current, error: fetchError } = await supabase
    .from('confidence_tracker_assignment_skills')
    .select('skill_id')
    .eq('assignment_id', assignmentId)
  if (fetchError) return { error: fetchError.message }

  const currentIds = new Set((current ?? []).map(r => r.skill_id))
  const nextIds = new Set(skillIds)

  const toAdd = skillIds.filter(id => !currentIds.has(id))
  const toRemove = [...currentIds].filter(id => !nextIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('confidence_tracker_assignment_skills')
      .delete()
      .eq('assignment_id', assignmentId)
      .in('skill_id', toRemove)
    if (error) return { error: error.message }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('confidence_tracker_assignment_skills')
      .insert(toAdd.map(skill_id => ({ assignment_id: assignmentId, skill_id })))
    if (error) return { error: error.message }
  }

  return { error: null }
}

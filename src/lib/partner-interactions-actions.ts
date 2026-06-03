'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PartnerDepartment } from '@/lib/partner-constants'
export type { PartnerDepartment } from '@/lib/partner-constants'

async function requireStaffOrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' as const, supabase: null, user: null }
  }

  return { error: null, supabase, user: { ...user, name: profile.name as string } }
}

// ─── Interactions ────────────────────────────────────────────────────────────

export async function logInteraction(data: {
  partner_id: string
  note: string
  interaction_date: string
  department?: PartnerDepartment | null
}) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase.from('partner_interactions').insert({
    partner_id: data.partner_id,
    note: data.note,
    interaction_date: data.interaction_date,
    department: data.department ?? null,
    user_id: user!.id,
  })
  if (dbError) return { error: dbError.message }

  // Update last_interaction_date on the partner record
  await supabase
    .from('partners')
    .update({ last_interaction_date: data.interaction_date })
    .eq('id', data.partner_id)
    .lt('last_interaction_date', data.interaction_date)

  revalidatePath(`/instructor/partnerships/${data.partner_id}`)
  revalidatePath('/instructor/partnerships')
  return { error: null }
}

export async function listInteractions(partnerId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, interactions: [] }

  const { data, error: dbError } = await supabase
    .from('partner_interactions')
    .select('id, note, interaction_date, department, created_at, user_id, users(name)')
    .eq('partner_id', partnerId)
    .order('interaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (dbError) return { error: dbError.message, interactions: [] }
  return { error: null, interactions: data ?? [] }
}

export async function deleteInteraction(id: string, partnerId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase.from('partner_interactions').delete().eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidatePath(`/instructor/partnerships/${partnerId}`)
  return { error: null }
}

// ─── Department Status ───────────────────────────────────────────────────────

export async function getDepartmentStatuses(partnerId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, statuses: [] }

  const { data, error: dbError } = await supabase
    .from('partner_department_status')
    .select('id, department, stage, updated_at, updated_by, users(name)')
    .eq('partner_id', partnerId)

  if (dbError) return { error: dbError.message, statuses: [] }
  return { error: null, statuses: data ?? [] }
}

export async function setDepartmentStatus(
  partnerId: string,
  department: PartnerDepartment,
  stage: string
) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partner_department_status')
    .upsert(
      { partner_id: partnerId, department, stage, updated_by: user!.id },
      { onConflict: 'partner_id,department' }
    )

  if (dbError) return { error: dbError.message }

  revalidatePath(`/instructor/partnerships/${partnerId}`)
  return { error: null }
}

export async function removeDepartmentStatus(partnerId: string, department: PartnerDepartment) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partner_department_status')
    .delete()
    .eq('partner_id', partnerId)
    .eq('department', department)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/instructor/partnerships/${partnerId}`)
  return { error: null }
}

// ─── Referrals ───────────────────────────────────────────────────────────────

export type ReferralDirection = 'inbound' | 'outbound'

export interface ReferralFormData {
  student_identifier: string
  direction: ReferralDirection
  partner_id: string | null
  referral_date: string
  referral_type: string | null
  outcome_rating: number | null
  outcome_notes: string | null
  student_city: string | null
  open_to_relocation: boolean
  is_veteran: boolean
  is_neurodivergent: boolean
  other_flags: string[]
  // Extended fields (new columns)
  student_user_id?: string | null
  service_category?: string | null
  outcome_success?: boolean | null
  staff_notes?: string | null
}

export async function createReferral(data: ReferralFormData) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase.from('student_referrals').insert({
    ...data,
    logged_by: user!.id,
  })
  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/referrals')
  return { error: null }
}

export async function updateReferral(id: string, data: Partial<ReferralFormData>) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('student_referrals')
    .update(data)
    .eq('id', id)

  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/referrals')
  return { error: null }
}

export async function deleteReferral(id: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase.from('student_referrals').delete().eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/referrals')
  return { error: null }
}

export async function listReferrals(filters?: {
  direction?: ReferralDirection
  partner_id?: string
  from_date?: string
  to_date?: string
}) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, referrals: [] }

  let query = supabase
    .from('student_referrals')
    .select(`
      id, student_identifier, direction, referral_date, referral_type,
      outcome_rating, outcome_notes, student_city, open_to_relocation,
      is_veteran, is_neurodivergent, other_flags, created_at,
      partner_id,
      partners (name),
      logged_by,
      users (name)
    `)
    .order('referral_date', { ascending: false })

  if (filters?.direction) query = query.eq('direction', filters.direction)
  if (filters?.partner_id) query = query.eq('partner_id', filters.partner_id)
  if (filters?.from_date) query = query.gte('referral_date', filters.from_date)
  if (filters?.to_date) query = query.lte('referral_date', filters.to_date)

  const { data, error: dbError } = await query
  if (dbError) return { error: dbError.message, referrals: [] }
  return { error: null, referrals: data ?? [] }
}

// ─── Duplicate detection ─────────────────────────────────────────────────────

export async function findSimilarPartners(name: string, excludeId?: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, matches: [] }

  const { data, error: dbError } = await supabase
    .from('partners')
    .select('id, name, city, state')
    .ilike('name', `%${name.trim()}%`)
    .order('name')
    .limit(5)

  if (dbError) return { error: dbError.message, matches: [] }

  const matches = (data ?? []).filter(p => p.id !== excludeId)
  return { error: null, matches }
}

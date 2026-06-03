'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PartnerDepartment } from '@/lib/partner-constants'
export type { PartnerDepartment } from '@/lib/partner-constants'
import { notifyStaff, notifyByEmail } from '@/lib/slack'

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
  course_name?: string | null
}

export async function createReferral(data: ReferralFormData) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { data: inserted, error: dbError } = await supabase
    .from('student_referrals')
    .insert({ ...data, logged_by: user!.id })
    .select('id')
    .single()
  if (dbError) return { error: dbError.message }

  // Auto-tag the partner as Student Success when an outbound referral is made
  if (data.direction === 'outbound' && data.partner_id) {
    await supabase
      .from('partner_department_status')
      .upsert(
        { partner_id: data.partner_id, department: 'student_success', stage: 'Active' },
        { onConflict: 'partner_id,department', ignoreDuplicates: true }
      )
    revalidatePath('/instructor/partnerships/all')
    revalidatePath(`/instructor/partnerships/${data.partner_id}`)
  }

  // If this is an outbound referral with a linked student, check whether we
  // should immediately send the rating-request ping (referral date is 60+ days ago)
  // or let the nightly cron handle it when the time comes.
  if (
    data.direction === 'outbound' &&
    data.student_user_id &&
    data.partner_id &&
    inserted?.id
  ) {
    const referralDate = new Date(data.referral_date + 'T00:00:00')
    const daysSince = (Date.now() - referralDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSince >= 60) {
      // Fetch student email + partner name to build the message
      const service = createServiceSupabaseClient()
      const [{ data: studentRow }, { data: partnerRow }] = await Promise.all([
        service.from('users').select('name, email').eq('id', data.student_user_id).single(),
        service.from('partners').select('name').eq('id', data.partner_id).single(),
      ])

      if (studentRow && partnerRow) {
        const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
        const ratingUrl = `${APP_URL}/student/referrals/rate/${inserted.id}`
        const categoryText = data.service_category ? ` for ${data.service_category}` : ''
        const studentMsg =
          `Hi ${studentRow.name}! We referred you to ${partnerRow.name}${categoryText} a while back. ` +
          `If you had a chance to connect with them, we'd love to hear how it went: ${ratingUrl}`

        // DM the student
        await notifyByEmail(studentRow.email, studentMsg)

        // Ping staff
        await notifyStaff(
          `${studentRow.name} has received their invitation to rate their referral to ${partnerRow.name}${categoryText}.`
        )

        // Mark sent so the nightly cron doesn't double-send
        await supabase
          .from('student_referrals')
          .update({ rating_request_sent_at: new Date().toISOString() })
          .eq('id', inserted.id)
      }
    }
  }

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
  // Use service role to bypass RLS — calling page already enforces staff/admin auth
  const supabase = createServiceSupabaseClient()

  let query = supabase
    .from('student_referrals')
    .select(`
      id, student_identifier, direction, referral_date, referral_type,
      outcome_rating, outcome_notes, student_city, open_to_relocation,
      is_veteran, is_neurodivergent, other_flags, created_at,
      partner_id,
      partners (name),
      logged_by,
      users!student_referrals_logged_by_fkey (name)
    `)
    .order('referral_date', { ascending: false })

  query = query.eq('direction', filters?.direction ?? 'outbound')
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

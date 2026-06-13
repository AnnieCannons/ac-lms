'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PartnerDepartment } from '@/lib/partner-constants'
export type { PartnerDepartment } from '@/lib/partner-constants'
import { notifyStaff, notifyByEmail, scheduleSlackDM } from '@/lib/slack'

async function requireStaffOrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role, name, slack_email')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' as const, supabase: null, user: null }
  }

  return { error: null, supabase, user: { ...user, name: profile.name as string, slack_email: (profile.slack_email as string | null) ?? null } }
}

// ─── Interactions ────────────────────────────────────────────────────────────

export async function logInteraction(data: {
  partner_id: string
  note: string
  interaction_date: string
  department?: PartnerDepartment | null
  contact_id?: string | null
  remind_in_days?: number | null
}) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  // Persist the reminder so the activity timeline can show it. reminder_at is the
  // date the Slack DM fires (computed the same way as postAt below).
  const hasReminder = data.remind_in_days != null && data.remind_in_days > 0
  const reminderDays = hasReminder ? Math.round(data.remind_in_days!) : null
  const reminderAt = hasReminder
    ? new Date(Date.now() + data.remind_in_days! * 86400 * 1000).toISOString().slice(0, 10)
    : null

  const { error: dbError } = await supabase.from('partner_interactions').insert({
    partner_id: data.partner_id,
    note: data.note,
    interaction_date: data.interaction_date,
    department: data.department ?? null,
    contact_id: data.contact_id ?? null,
    reminder_days: reminderDays,
    reminder_at: reminderAt,
    user_id: user!.id,
  })
  if (dbError) return { error: dbError.message }

  // Update last_interaction_date on the partner record — only move it forward,
  // but also set it when it's currently NULL (NULL < date is not true in SQL).
  await supabase
    .from('partners')
    .update({ last_interaction_date: data.interaction_date })
    .eq('id', data.partner_id)
    .or(`last_interaction_date.is.null,last_interaction_date.lt.${data.interaction_date}`)

  // Schedule Slack follow-up reminder if requested
  if (data.remind_in_days != null && data.remind_in_days > 0 && user?.email) {
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const { data: partnerRow } = await supabase
      .from('partners').select('name').eq('id', data.partner_id).single()
    const partnerName = partnerRow?.name ?? 'partner'
    const postAt = Math.floor(Date.now() / 1000) + data.remind_in_days * 86400
    const slackEmail = user.slack_email || user.email
    const scheduled = await scheduleSlackDM(
      slackEmail,
      `⏰ Follow-up reminder: ${partnerName}\n${APP_URL}/instructor/partnerships/${data.partner_id}`,
      postAt
    )
    if (!scheduled) {
      console.warn(`[reminder] Slack DM not scheduled for ${slackEmail} — no matching Slack user (set users.slack_email if their Slack email differs).`)
    }
  }

  revalidatePath(`/instructor/partnerships/${data.partner_id}`)
  revalidatePath('/instructor/partnerships')
  return { error: null }
}

export async function listInteractions(partnerId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, interactions: [] }

  const { data, error: dbError } = await supabase
    .from('partner_interactions')
    .select('id, note, interaction_date, department, created_at, user_id, contact_id, reminder_days, reminder_at, users(name), partner_contacts!partner_interactions_contact_id_fkey(name, title)')
    .eq('partner_id', partnerId)
    .order('interaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (dbError) return { error: dbError.message, interactions: [] }
  return { error: null, interactions: data ?? [] }
}

export async function deleteInteraction(id: string, partnerId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partner_interactions')
    .delete()
    .eq('id', id)
    .eq('partner_id', partnerId)
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
    .select('id, department, stage, updated_at, updated_by, do_not_email, users(name)')
    .eq('partner_id', partnerId)

  if (dbError) return { error: dbError.message, statuses: [] }
  return { error: null, statuses: data ?? [] }
}

// Org-wide but dept-specific do-not-email: each department independently flags
// whether this partner org should be excluded from that department's outreach.
export async function setDepartmentDoNotEmail(
  partnerId: string,
  department: PartnerDepartment,
  value: boolean
) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, interaction: null }

  const { error: dbError } = await supabase
    .from('partner_department_status')
    .update({ do_not_email: value })
    .eq('partner_id', partnerId)
    .eq('department', department)

  if (dbError) return { error: dbError.message, interaction: null }

  // Log this change as an activity so it appears in the timeline
  const today = new Date().toISOString().slice(0, 10)
  const note = value
    ? `Do not email enabled for this department.`
    : `Do not email removed — back on email list.`

  const { data: inserted } = await supabase
    .from('partner_interactions')
    .insert({
      partner_id: partnerId,
      note,
      interaction_date: today,
      department,
      user_id: user!.id,
    })
    .select('id, note, interaction_date, department, created_at, user_id')
    .single()

  const interaction = inserted
    ? { ...inserted, users: { name: user!.name }, partner_contacts: null }
    : null

  revalidatePath(`/instructor/partnerships/${partnerId}`)
  return { error: null, interaction }
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

type HistoryRow = { id: string; department: string; stage: string; changed_at: string; users: { name: string } | null }

export async function getAllStageHistory(partnerId: string): Promise<{ error: string | null; history: HistoryRow[] }> {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error: error ?? null, history: [] }

  const { data, error: dbError } = await supabase
    .from('partner_department_status_history')
    .select('id, department, stage, changed_at, users(name)')
    .eq('partner_id', partnerId)
    .order('changed_at', { ascending: true })

  if (dbError) return { error: dbError.message, history: [] }
  const history: HistoryRow[] = (data ?? []).map(row => ({
    id: row.id,
    department: row.department,
    stage: row.stage,
    changed_at: row.changed_at,
    users: Array.isArray(row.users) ? (row.users[0] ?? null) : row.users,
  }))
  return { error: null, history }
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
  console.log(`[referral debug] direction=${data.direction}, student_user_id=${JSON.stringify(data.student_user_id)}, partner_id=${data.partner_id}, inserted_id=${inserted?.id}`)

  if (
    data.direction === 'outbound' &&
    data.student_user_id &&
    data.partner_id &&
    inserted?.id
  ) {
    const referralDate = new Date(data.referral_date + 'T00:00:00')
    const daysSince = (Date.now() - referralDate.getTime()) / (1000 * 60 * 60 * 24)

    console.log(`[referral] daysSince=${daysSince.toFixed(1)}, student_user_id=${data.student_user_id}, partner_id=${data.partner_id}`)

    if (daysSince >= 60) {
      // Fetch student email + partner name to build the message
      const service = createServiceSupabaseClient()
      const [{ data: studentRow, error: sErr }, { data: partnerRow, error: pErr }] = await Promise.all([
        service.from('users').select('name, email, slack_email').eq('id', data.student_user_id).single(),
        service.from('partners').select('name').eq('id', data.partner_id).single(),
      ])

      console.log(`[referral] studentRow=${JSON.stringify(studentRow)}, sErr=${sErr?.message}, partnerRow=${JSON.stringify(partnerRow)}, pErr=${pErr?.message}`)

      if (studentRow && partnerRow) {
        const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
        const ratingUrl = `${APP_URL}/student/referrals/rate/${inserted.id}`
        const categoryText = data.service_category ? ` for ${data.service_category}` : ''
        const studentMsg =
          `Hi ${studentRow.name}! We referred you to ${partnerRow.name}${categoryText} a while back. ` +
          `If you had a chance to connect with them, we'd love to hear how it went: ${ratingUrl}`

        // DM the student
        const studentSlackEmail = studentRow.slack_email || studentRow.email
        const studentSent = await notifyByEmail(studentSlackEmail, studentMsg)
        console.log(`[referral] notifyByEmail(${studentSlackEmail}) → ${studentSent}`)

        // Ping staff
        await notifyStaff(
          `${studentRow.name} has received their invitation to rate their referral to ${partnerRow.name}${categoryText}.`
        )
        console.log(`[referral] notifyStaff done`)

        // Mark sent so the nightly cron doesn't double-send
        await supabase
          .from('student_referrals')
          .update({ rating_request_sent_at: new Date().toISOString() })
          .eq('id', inserted.id)
      } else {
        console.warn(`[referral] skipping notification — studentRow or partnerRow missing`)
      }
    } else {
      console.log(`[referral] not yet 60 days — notification deferred to cron`)
    }
  }

  revalidatePath('/instructor/partnerships/referrals')
  return { error: null, id: inserted.id }
}

export async function updateReferral(id: string, data: Partial<ReferralFormData>) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('student_referrals')
    .update(data)
    .eq('id', id)

  if (dbError) return { error: dbError.message }

  // No revalidatePath here — the client handles optimistic updates via onUpdated.
  // revalidatePath would trigger an RSC re-render mid-interaction and lose local state.
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
  const { error } = await requireStaffOrAdmin()
  if (error) return { error, referrals: [] }

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
      users!student_referrals_logged_by_fkey (name),
      partner_ratings (score, reviewer_type)
    `)
    .order('referral_date', { ascending: false })

  query = query.eq('direction', filters?.direction ?? 'outbound')
  if (filters?.partner_id) query = query.eq('partner_id', filters.partner_id)
  if (filters?.from_date) query = query.gte('referral_date', filters.from_date)
  if (filters?.to_date) query = query.lte('referral_date', filters.to_date)

  const { data, error: dbError } = await query
  if (dbError) return { error: dbError.message, referrals: [] }

  // Compute average student rating per referral
  const referrals = (data ?? []).map(r => {
    const scores = (r.partner_ratings ?? [])
      .filter((pr: { reviewer_type: string; score: number }) => pr.reviewer_type === 'student')
      .map((pr: { reviewer_type: string; score: number }) => pr.score)
    const student_avg_rating = scores.length > 0
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      : null
    return { ...r, student_avg_rating }
  })

  return { error: null, referrals }
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

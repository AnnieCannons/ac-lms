'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PartnerStatus = 'prospect' | 'active' | 'inactive' | 'in_onboarding'
export type PartnerType = 'service_provider' | 'corporate' | 'funder' | 'advisory' | 'mentorship' | 'apprenticeship' | 'media' | 'admissions_referral'

export interface PartnerContact {
  id?: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  linkedin_url?: string | null
  website_url?: string | null
}

export interface PartnerFormData {
  name: string
  city: string | null
  state: string | null
  multi_city: boolean
  how_we_met: string | null
  services_focus_area: string | null
  status: PartnerStatus
  last_interaction_date: string | null
  meeting_notes: string | null
  tags: string[]
  internal_owner_id: string | null
  referred_by: string | null
  partner_types: PartnerType[]
  contacts: PartnerContact[]
}

async function requireStaffOrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' as const, supabase: null, user: null }
  }

  return { error: null, supabase, user }
}

export async function listPartners() {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, partners: [] }

  const { data, error: dbError } = await supabase
    .from('partners')
    .select(`
      id, name, city, state, status, last_interaction_date, internal_owner_id,
      partner_type_assignments (partner_type),
      partner_contacts (id, name, title, email, is_primary),
      partner_department_status (department, stage),
      partner_interactions (id, note, interaction_date, department, users(name)),
      student_referrals (student_identifier, direction)
    `)
    .order('name')

  if (dbError) return { error: dbError.message, partners: [] }

  // Sort interactions descending and keep only the most recent per partner
  const partners = (data ?? []).map(p => {
    const sorted = [...(p.partner_interactions ?? [])].sort(
      (a, b) => new Date(b.interaction_date).getTime() - new Date(a.interaction_date).getTime()
    )
    return { ...p, latest_interaction: sorted[0] ?? null }
  })

  return { error: null, partners }
}

export async function getPartner(id: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, partner: null }

  const { data, error: dbError } = await supabase
    .from('partners')
    .select(`
      *,
      partner_type_assignments (partner_type),
      partner_contacts (*)
    `)
    .eq('id', id)
    .single()

  if (dbError) return { error: dbError.message, partner: null }
  return { error: null, partner: data }
}

export async function createPartner(formData: PartnerFormData) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { partner_types, contacts, ...partnerFields } = formData

  const { data: partner, error: insertError } = await supabase
    .from('partners')
    .insert(partnerFields)
    .select('id')
    .single()

  if (insertError || !partner) return { error: insertError?.message ?? 'Insert failed' }

  if (partner_types.length > 0) {
    await supabase.from('partner_type_assignments').insert(
      partner_types.map(t => ({ partner_id: partner.id, partner_type: t }))
    )
  }

  if (contacts.length > 0) {
    await supabase.from('partner_contacts').insert(
      contacts.map(c => ({ ...c, partner_id: partner.id }))
    )
  }

  revalidatePath('/instructor/partnerships')
  return { error: null, id: partner.id }
}

export async function updatePartner(id: string, formData: PartnerFormData) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { partner_types, contacts, ...partnerFields } = formData

  const { error: updateError } = await supabase
    .from('partners')
    .update(partnerFields)
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  // Replace type assignments
  await supabase.from('partner_type_assignments').delete().eq('partner_id', id)
  if (partner_types.length > 0) {
    await supabase.from('partner_type_assignments').insert(
      partner_types.map(t => ({ partner_id: id, partner_type: t }))
    )
  }

  // Upsert contacts: delete removed, insert new, update existing
  const existingIds = contacts.filter(c => c.id).map(c => c.id!)
  await supabase
    .from('partner_contacts')
    .delete()
    .eq('partner_id', id)
    .not('id', 'in', existingIds.length > 0 ? `(${existingIds.join(',')})` : '(null)')

  for (const contact of contacts) {
    if (contact.id) {
      await supabase.from('partner_contacts').update({
        name: contact.name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
        is_primary: contact.is_primary,
        notes: contact.notes,
      }).eq('id', contact.id)
    } else {
      await supabase.from('partner_contacts').insert({ ...contact, partner_id: id })
    }
  }

  revalidatePath('/instructor/partnerships')
  revalidatePath(`/instructor/partnerships/${id}`)
  return { error: null }
}

export async function deletePartner(id: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: deleteError } = await supabase.from('partners').delete().eq('id', id)
  if (deleteError) return { error: deleteError.message }

  revalidatePath('/instructor/partnerships')
  return { error: null }
}

export async function listPartnersWithGeo() {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, partners: [] }

  const { data, error: dbError } = await supabase
    .from('partners')
    .select('id, name, city, state, multi_city, services_focus_area, partner_type_assignments(partner_type)')
    .order('name')

  if (dbError) return { error: dbError.message, partners: [] }
  return { error: null, partners: data ?? [] }
}

export async function listStaffUsers() {
  const { error } = await requireStaffOrAdmin()
  if (error) return { error, users: [] }

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('users')
    .select('id, name')
    .in('role', ['staff', 'admin'])
    .order('name')

  return { error: null, users: data ?? [] }
}

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

export type PartnerDepartment = 'student_success' | 'career_development' | 'resourcefull' | 'funding_partnerships' | 'admissions'

export interface PartnerLocation {
  id?: string
  city: string | null
  state: string | null
}

export interface PartnerFormData {
  name: string
  city: string | null
  state: string | null
  multi_city: boolean
  locations: PartnerLocation[]
  website: string | null
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
  departments: PartnerDepartment[]
  service_categories: string[]
}

function validateContactUrls(contacts: PartnerContact[]): string | null {
  for (const c of contacts) {
    for (const field of [c.linkedin_url, c.website_url]) {
      if (field && !field.startsWith('https://') && !field.startsWith('http://')) {
        return `Invalid URL: "${field}" — must start with http:// or https://`
      }
    }
  }
  return null
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
      id, name, city, state, status, last_interaction_date, internal_owner_id, service_categories,
      do_not_email, do_not_email_notes, do_not_email_set_at,
      partner_type_assignments (partner_type),
      partner_contacts (id, name, title, email, is_primary, website_url),
      partner_department_status (department, stage),
      partner_interactions (id, note, interaction_date, department, users(name)),
      student_referrals (student_identifier, direction),
      partner_ratings (score, reviewer_type),
      partner_locations (city, state, sort_order)
    `)
    .order('name')

  if (dbError) return { error: dbError.message, partners: [] }

  // Sort interactions descending and keep only the most recent per partner
  // Also compute a combined student rating (avg of all student scores)
  const partners = (data ?? []).map(p => {
    const sorted = [...(p.partner_interactions ?? [])].sort(
      (a, b) => new Date(b.interaction_date).getTime() - new Date(a.interaction_date).getTime()
    )
    const studentScores = (p.partner_ratings ?? [])
      .filter((r: { reviewer_type: string; score: number }) => r.reviewer_type === 'student')
      .map((r: { reviewer_type: string; score: number }) => r.score)
    const combined_student_rating = studentScores.length > 0
      ? { avg: studentScores.reduce((a: number, b: number) => a + b, 0) / studentScores.length, count: studentScores.length }
      : null
    return { ...p, latest_interaction: sorted[0] ?? null, combined_student_rating }
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
      partner_contacts (*),
      partner_locations (id, city, state, sort_order)
    `)
    .eq('id', id)
    .single()

  if (dbError) return { error: dbError.message, partner: null }
  return { error: null, partner: data }
}

export async function createPartner(formData: PartnerFormData) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { partner_types, contacts, departments, locations, ...partnerFields } = formData
  const urlError = validateContactUrls(contacts)
  if (urlError) return { error: urlError }

  // Sync primary city/state from first location
  const primaryLocation = locations[0] ?? null
  const syncedFields = {
    ...partnerFields,
    city: primaryLocation?.city ?? partnerFields.city,
    state: primaryLocation?.state ?? partnerFields.state,
    multi_city: locations.length > 1 ? true : partnerFields.multi_city,
    service_categories: partnerFields.service_categories ?? [],
  }

  const { data: partner, error: insertError } = await supabase
    .from('partners')
    .insert(syncedFields)
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

  if (departments.length > 0) {
    await supabase.from('partner_department_status').insert(
      departments.map(d => ({ partner_id: partner.id, department: d, stage: 'Prospect' }))
    )
  }

  if (locations.length > 0) {
    await supabase.from('partner_locations').insert(
      locations.map((l, i) => ({ partner_id: partner.id, city: l.city, state: l.state, sort_order: i }))
    )
  }

  revalidatePath('/instructor/partnerships')
  return { error: null, id: partner.id }
}

export async function updatePartner(id: string, formData: PartnerFormData) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { partner_types, contacts, departments, locations, ...partnerFields } = formData
  const urlError = validateContactUrls(contacts)
  if (urlError) return { error: urlError }

  // Sync primary city/state from first location
  const primaryLocation = locations[0] ?? null
  const syncedFields = {
    ...partnerFields,
    city: primaryLocation?.city ?? partnerFields.city,
    state: primaryLocation?.state ?? partnerFields.state,
    multi_city: locations.length > 1 ? true : partnerFields.multi_city,
  }

  const { error: updateError } = await supabase
    .from('partners')
    .update(syncedFields)
    .eq('id', id)

  if (updateError) return { error: updateError.message }

  // Replace type assignments
  await supabase.from('partner_type_assignments').delete().eq('partner_id', id)
  if (partner_types.length > 0) {
    await supabase.from('partner_type_assignments').insert(
      partner_types.map(t => ({ partner_id: id, partner_type: t }))
    )
  }

  // Diff department assignments — only add new / remove dropped; never touch existing stages
  const { data: currentDepts } = await supabase
    .from('partner_department_status')
    .select('department')
    .eq('partner_id', id)
  const currentDeptNames = (currentDepts ?? []).map((d: { department: string }) => d.department)
  const removed = currentDeptNames.filter((d: string) => !departments.includes(d as PartnerDepartment))
  const added = departments.filter(d => !currentDeptNames.includes(d))
  if (removed.length > 0) {
    await supabase.from('partner_department_status').delete()
      .eq('partner_id', id).in('department', removed)
  }
  if (added.length > 0) {
    await supabase.from('partner_department_status').insert(
      added.map(d => ({ partner_id: id, department: d, stage: '' }))
    )
  }

  // Replace locations
  await supabase.from('partner_locations').delete().eq('partner_id', id)
  if (locations.length > 0) {
    await supabase.from('partner_locations').insert(
      locations.map((l, i) => ({ partner_id: id, city: l.city, state: l.state, sort_order: i }))
    )
  }

  // Contacts are managed via the department tab UI — skip here to avoid clobbering them.

  revalidatePath('/instructor/partnerships')
  revalidatePath(`/instructor/partnerships/${id}`)
  return { error: null }
}

export async function setDoNotEmail(
  partnerId: string,
  value: boolean,
  notes: string
) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partners')
    .update({
      do_not_email: value,
      do_not_email_notes: value ? notes.trim() || null : null,
      do_not_email_set_at: value ? new Date().toISOString() : null,
      do_not_email_set_by: value ? user!.id : null,
    })
    .eq('id', partnerId)

  if (dbError) return { error: dbError.message }
  revalidatePath(`/instructor/partnerships/${partnerId}`)
  return { error: null }
}

export async function setPartnerOwner(partnerId: string, ownerId: string | null) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partners')
    .update({ internal_owner_id: ownerId || null })
    .eq('id', partnerId)

  if (dbError) return { error: dbError.message }
  revalidatePath(`/instructor/partnerships/${partnerId}`)
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
    .select(`
      id, name, city, state, multi_city, services_focus_area, service_categories,
      partner_type_assignments (partner_type),
      partner_department_status (department)
    `)
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

export async function archiveContact(contactId: string, archived: boolean) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partner_contacts')
    .update({ is_archived: archived })
    .eq('id', contactId)

  if (dbError) return { error: dbError.message }
  return { error: null }
}

export interface ContactData {
  name: string
  title: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  notes: string | null
  linkedin_url: string | null
  website_url: string | null
  departments: string[] | null
}

export async function createContact(partnerId: string, data: ContactData) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, contact: null }

  const { data: row, error: dbError } = await supabase
    .from('partner_contacts')
    .insert({ ...data, partner_id: partnerId })
    .select('*')
    .single()

  if (dbError) return { error: dbError.message, contact: null }
  return { error: null, contact: row }
}

export async function updateContact(contactId: string, data: Partial<ContactData>) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partner_contacts')
    .update(data)
    .eq('id', contactId)

  if (dbError) return { error: dbError.message }
  return { error: null }
}

export async function deleteContact(contactId: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('partner_contacts')
    .delete()
    .eq('id', contactId)

  if (dbError) return { error: dbError.message }
  return { error: null }
}

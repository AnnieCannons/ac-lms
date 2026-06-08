'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logInteraction } from '@/lib/partner-interactions-actions'
import type { PartnerDepartment } from '@/lib/partner-constants'

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

export interface EmailListRecipient {
  partnerId: string
  contactId: string | null
  email: string
  partnerName: string
  contactName: string | null
  isPrimary: boolean
}

export async function saveEmailList(data: {
  name: string
  subject: string
  department: PartnerDepartment
  filtersUsed: Record<string, unknown>
  recipients: EmailListRecipient[]
  logInteractions: boolean
  notes?: string
}) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, id: null }

  const today = new Date().toISOString().slice(0, 10)

  const { data: list, error: insertError } = await supabase
    .from('email_lists')
    .insert({
      name: data.name,
      subject: data.subject,
      department: data.department,
      filters_used: data.filtersUsed,
      created_by: user!.id,
      sent_at: new Date().toISOString(),
      notes: data.notes ?? null,
    })
    .select('id')
    .single()

  if (insertError || !list) return { error: insertError?.message ?? 'Insert failed', id: null }

  const rows = data.recipients.map(r => ({
    email_list_id: list.id,
    partner_id: r.partnerId,
    contact_id: r.contactId ?? null,
    email: r.email,
    partner_name: r.partnerName,
    contact_name: r.contactName ?? null,
    is_primary: r.isPrimary,
  }))

  const { error: recipientsError } = await supabase
    .from('email_list_recipients')
    .insert(rows)

  if (recipientsError) return { error: recipientsError.message, id: null }

  if (data.logInteractions) {
    const uniquePartnerIds = [...new Set(data.recipients.map(r => r.partnerId))]
    await Promise.all(
      uniquePartnerIds.map(partnerId =>
        logInteraction({
          partner_id: partnerId,
          note: `Included in email list: ${data.name}`,
          interaction_date: today,
          department: data.department,
        })
      )
    )
  }

  revalidatePath('/instructor/partnerships/email-lists')
  return { error: null, id: list.id }
}

export async function listEmailLists() {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, lists: [] }

  const { data, error: dbError } = await supabase
    .from('email_lists')
    .select(`
      id, name, subject, department, filters_used, sent_at, notes, created_at,
      users ( name ),
      email_list_recipients ( id, email, partner_name, contact_name, is_primary, partner_id )
    `)
    .order('created_at', { ascending: false })

  if (dbError) return { error: dbError.message, lists: [] }
  return { error: null, lists: data ?? [] }
}

export async function updateEmailList(id: string, data: { name?: string; notes?: string | null }) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('email_lists')
    .update(data)
    .eq('id', id)

  if (dbError) return { error: dbError.message }
  revalidatePath('/instructor/partnerships/email-lists')
  return { error: null }
}

export async function deleteEmailList(id: string) {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase
    .from('email_lists')
    .delete()
    .eq('id', id)

  if (dbError) return { error: dbError.message }
  revalidatePath('/instructor/partnerships/email-lists')
  return { error: null }
}

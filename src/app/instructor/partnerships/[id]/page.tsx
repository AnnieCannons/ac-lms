import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import PartnerForm from '@/components/ui/PartnerForm'
import { getPartner, updatePartner, listStaffUsers, type PartnerType, type PartnerFormData } from '@/lib/partner-actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PartnerDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const [{ partner }, { users: staffUsers }] = await Promise.all([
    getPartner(id),
    listStaffUsers(),
  ])

  if (!partner) notFound()

  const initialData: Partial<PartnerFormData> = {
    name: partner.name,
    city: partner.city,
    state: partner.state,
    multi_city: partner.multi_city,
    how_we_met: partner.how_we_met,
    services_focus_area: partner.services_focus_area,
    status: partner.status,
    last_interaction_date: partner.last_interaction_date,
    meeting_notes: partner.meeting_notes,
    tags: partner.tags ?? [],
    internal_owner_id: partner.internal_owner_id,
    referred_by: partner.referred_by,
    partner_types: (partner.partner_type_assignments ?? []).map(
      (t: { partner_type: PartnerType }) => t.partner_type
    ),
    contacts: partner.partner_contacts ?? [],
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/instructor/partnerships" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← Partnerships
          </Link>
          <h1 className="text-2xl font-bold text-dark-text mt-3">{partner.name}</h1>
        </div>

        <PartnerForm
          initialData={initialData}
          staffUsers={staffUsers}
          onSubmit={updatePartner.bind(null, id)}
          submitLabel="Save Changes"
          partnerId={id}
        />
      </main>
    </div>
  )
}

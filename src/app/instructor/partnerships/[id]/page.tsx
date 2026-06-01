import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import PartnerOverview from '@/components/ui/PartnerOverview'
import {
  getPartner,
  updatePartner,
  deletePartner,
  listStaffUsers,
  type PartnerType,
} from '@/lib/partner-actions'
import { listInteractions, getDepartmentStatuses, type PartnerDepartment } from '@/lib/partner-interactions-actions'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ dept?: string }>
}

export default async function PartnerDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { dept } = await searchParams

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const [
    { partner },
    { users: staffUsers },
    { interactions },
    { statuses: departmentStatuses },
  ] = await Promise.all([
    getPartner(id),
    listStaffUsers(),
    listInteractions(id),
    getDepartmentStatuses(id),
  ])

  if (!partner) notFound()

  const partnerData = {
    ...partner,
    partner_type_assignments: (partner.partner_type_assignments ?? []) as { partner_type: PartnerType }[],
    partner_contacts: partner.partner_contacts ?? [],
    tags: partner.tags ?? [],
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/instructor/partnerships" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← Partnerships
          </Link>
        </div>

        <PartnerOverview
          partner={partnerData}
          interactions={interactions as Parameters<typeof PartnerOverview>[0]['interactions']}
          departmentStatuses={departmentStatuses as Parameters<typeof PartnerOverview>[0]['departmentStatuses']}
          staffUsers={staffUsers}
          defaultDepartment={dept as PartnerDepartment | undefined}
          onUpdatePartner={updatePartner.bind(null, id)}
          onDeletePartner={deletePartner.bind(null, id)}
        />
      </main>
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
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
    <main className="max-w-4xl mx-auto px-6 py-10">
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
  )
}

import { notFound } from 'next/navigation'
import PartnerOverview from '@/components/ui/PartnerOverview'
import BackLink from '@/components/ui/BackLink'
import {
  getPartner,
  updatePartner,
  deletePartner,
  listStaffUsers,
  type PartnerType,
} from '@/lib/partner-actions'
import { listInteractions, getDepartmentStatuses, listReferrals, type PartnerDepartment } from '@/lib/partner-interactions-actions'
import { getPartnerRatingSummary } from '@/lib/partner-ratings-actions'
import { DEPARTMENT_LABELS } from '@/lib/partner-constants'

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
    { referrals: studentReferrals },
    { summary: ratingSummary },
  ] = await Promise.all([
    getPartner(id),
    listStaffUsers(),
    listInteractions(id),
    getDepartmentStatuses(id),
    listReferrals({ partner_id: id }),
    getPartnerRatingSummary(id),
  ])

  if (!partner) notFound()

  const backHref = dept && dept in DEPARTMENT_LABELS
    ? `/instructor/partnerships/all?dept=${dept}`
    : '/instructor/partnerships'
  const backLabel = dept && dept in DEPARTMENT_LABELS
    ? DEPARTMENT_LABELS[dept as PartnerDepartment]
    : 'Partners'

  const partnerData = {
    ...partner,
    partner_type_assignments: (partner.partner_type_assignments ?? []) as { partner_type: PartnerType }[],
    partner_contacts: partner.partner_contacts ?? [],
    tags: partner.tags ?? [],
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-4">
        <BackLink href={backHref}>{backLabel}</BackLink>
      </div>
      <PartnerOverview
        partner={partnerData}
        interactions={interactions as Parameters<typeof PartnerOverview>[0]['interactions']}
        departmentStatuses={departmentStatuses as Parameters<typeof PartnerOverview>[0]['departmentStatuses']}
        studentReferrals={studentReferrals as Parameters<typeof PartnerOverview>[0]['studentReferrals']}
        ratingSummary={ratingSummary}
        staffUsers={staffUsers}
        defaultDepartment={dept as PartnerDepartment | undefined}
        onUpdatePartner={updatePartner.bind(null, id)}
        onDeletePartner={deletePartner.bind(null, id)}
      />
    </main>
  )
}

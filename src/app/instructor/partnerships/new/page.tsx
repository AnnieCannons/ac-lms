import PartnerForm from '@/components/ui/PartnerForm'
import { createPartner, listStaffUsers, type PartnerDepartment } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS } from '@/lib/partner-constants'
import BackLink from '@/components/ui/BackLink'

interface Props {
  searchParams: Promise<{ dept?: string }>
}

export default async function NewPartnerPage({ searchParams }: Props) {
  const { dept } = await searchParams
  const { users: staffUsers } = await listStaffUsers()

  const department = (dept && dept in DEPARTMENT_LABELS) ? dept as PartnerDepartment : undefined
  const backHref = department
    ? `/instructor/partnerships/all?dept=${department}`
    : '/instructor/partnerships'
  const backLabel = department ? DEPARTMENT_LABELS[department] : 'Partners'
  const redirectTo = department
    ? `/instructor/partnerships/all?dept=${department}`
    : '/instructor/partnerships'

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <BackLink href={backHref}>{backLabel}</BackLink>
        <h1 className="text-2xl font-bold text-dark-text mt-3">Add Partner</h1>
      </div>

      <PartnerForm
        staffUsers={staffUsers}
        onSubmit={createPartner}
        submitLabel="Create Partner"
        defaultDepartment={department}
        redirectTo={redirectTo}
      />
    </main>
  )
}

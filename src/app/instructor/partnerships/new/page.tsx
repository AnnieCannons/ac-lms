import Link from 'next/link'
import PartnerForm from '@/components/ui/PartnerForm'
import { createPartner, listStaffUsers } from '@/lib/partner-actions'

export default async function NewPartnerPage() {
  const { users: staffUsers } = await listStaffUsers()

  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-text">Add Partner</h1>
      </div>

      <PartnerForm
        staffUsers={staffUsers}
        onSubmit={createPartner}
        submitLabel="Create Partner"
      />
    </main>
  )
}

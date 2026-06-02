import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import PartnerForm from '@/components/ui/PartnerForm'
import { createPartner, listStaffUsers, type PartnerDepartment } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS } from '@/lib/partner-constants'

interface Props {
  searchParams: Promise<{ dept?: string }>
}

export default async function NewPartnerPage({ searchParams }: Props) {
  const { dept } = await searchParams

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { users: staffUsers } = await listStaffUsers()

  const department = (dept && dept in DEPARTMENT_LABELS) ? dept as PartnerDepartment : undefined
  const backHref = department
    ? `/instructor/partnerships/all?dept=${department}`
    : '/instructor/partnerships'
  const backLabel = department ? `← ${DEPARTMENT_LABELS[department]}` : '← Partners'
  const redirectTo = department
    ? `/instructor/partnerships/all?dept=${department}`
    : '/instructor/partnerships'

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href={backHref} className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            {backLabel}
          </Link>
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
    </div>
  )
}

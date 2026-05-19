import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import PartnerForm from '@/components/ui/PartnerForm'
import { createPartner, listStaffUsers } from '@/lib/partner-actions'

export default async function NewPartnerPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { users: staffUsers } = await listStaffUsers()

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/instructor/partnerships" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← Partnerships
          </Link>
          <h1 className="text-2xl font-bold text-dark-text mt-3">Add Partner</h1>
        </div>

        <PartnerForm
          staffUsers={staffUsers}
          onSubmit={createPartner}
          submitLabel="Create Partner"
        />
      </main>
    </div>
  )
}

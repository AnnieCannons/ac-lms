import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import PartnershipsSidebar from '@/components/ui/PartnershipsSidebar'
import { listPartners } from '@/lib/partner-actions'
import type { PartnerDepartment } from '@/lib/partner-constants'

export default async function PartnershipsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { partners } = await listPartners()

  const deptCounts: Record<PartnerDepartment, number> = {
    student_success: 0,
    career_development: 0,
    resourcefull: 0,
    funding_partnerships: 0,
    admissions: 0,
  }
  for (const p of partners) {
    for (const ds of (p.partner_department_status ?? [])) {
      if (ds.department in deptCounts) {
        deptCounts[ds.department as PartnerDepartment]++
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <div className="flex">
        <PartnershipsSidebar deptCounts={deptCounts} totalCount={partners.length} />
        <div className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}

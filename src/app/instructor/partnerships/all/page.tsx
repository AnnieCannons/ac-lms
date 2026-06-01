import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import { listPartners } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, DEPT_COLORS, type PartnerDepartment } from '@/lib/partner-constants'
import PartnerList from '@/components/ui/PartnerList'

interface Props {
  searchParams: Promise<{ dept?: string }>
}

export default async function DepartmentPartnersPage({ searchParams }: Props) {
  const { dept } = await searchParams

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const department = dept as PartnerDepartment | undefined
  const deptLabel = department ? DEPARTMENT_LABELS[department] : null
  if (department && !deptLabel) redirect('/instructor/partnerships')

  const { partners } = await listPartners()

  // Filter to only partners enrolled in this department
  const filtered = department
    ? partners.filter(p =>
        (p.partner_department_status ?? []).some(
          (s: { department: string }) => s.department === department
        )
      )
    : partners

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-4xl mx-auto px-6 py-10">

        <div className="mb-8">
          <Link href="/instructor/partnerships" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← Partnerships
          </Link>
          <div className="flex items-center gap-3 mt-3">
            <h1 className="text-2xl font-bold text-dark-text">{deptLabel ?? 'All Partners'}</h1>
            {department && (
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${DEPT_COLORS[department]}`}>
                {filtered.length} partner{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {filtered.length === 0 && !department ? (
          <div className="text-center py-20 text-muted-text">
            <p className="text-lg font-medium mb-2">No partners yet</p>
            <Link href="/instructor/partnerships" className="text-sm text-teal-primary hover:underline">
              Go to all partners
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-text">
            <p className="text-lg font-medium mb-2">No partners in {deptLabel} yet</p>
            <p className="text-sm mb-6">
              Open a partner record and add it to the <strong>{deptLabel}</strong> department from the Department Journey section.
            </p>
            <Link href="/instructor/partnerships" className="text-sm text-teal-primary hover:underline">
              Go to all partners
            </Link>
          </div>
        ) : (
          <PartnerList partners={filtered as unknown as Parameters<typeof PartnerList>[0]['partners']} department={department} />
        )}
      </main>
    </div>
  )
}

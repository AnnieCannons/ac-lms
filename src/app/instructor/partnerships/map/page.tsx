import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import { listPartners } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, DEPT_COLORS, type PartnerDepartment } from '@/lib/partner-constants'
import PartnerMapWrapper from '@/components/ui/PartnerMapWrapper'

const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as PartnerDepartment[]

interface Props {
  searchParams: Promise<{ dept?: string }>
}

export default async function PartnerMapPage({ searchParams }: Props) {
  const { dept } = await searchParams
  const department = dept as PartnerDepartment | undefined

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { partners } = await listPartners()

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
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <Link href="/instructor/partnerships" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← Partners
          </Link>
          <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-dark-text">Partner Map</h1>
              <p className="text-sm text-muted-text mt-1">{filtered.length} partners · hover to preview, click to filter</p>
            </div>

            {/* Department filter pills */}
            <div className="flex flex-wrap gap-2">
              <Link
                href="/instructor/partnerships/map"
                className={`text-xs rounded-full px-3 py-1 font-medium border transition-colors ${
                  !department
                    ? 'bg-dark-text text-background border-dark-text'
                    : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
                }`}
              >
                All
              </Link>
              {ALL_DEPARTMENTS.map(dept => (
                <Link
                  key={dept}
                  href={`/instructor/partnerships/map?dept=${dept}`}
                  className={`text-xs rounded-full px-3 py-1 font-medium transition-colors ${
                    department === dept
                      ? DEPT_COLORS[dept]
                      : 'border border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
                  }`}
                >
                  {DEPARTMENT_LABELS[dept]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <PartnerMapWrapper
          partners={filtered as unknown as never}
          department={department}
        />
      </main>
    </div>
  )
}

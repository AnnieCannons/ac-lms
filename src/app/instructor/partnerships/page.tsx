import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import { listPartners } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, DEPT_COLORS, type PartnerDepartment } from '@/lib/partner-constants'
import PartnerList from '@/components/ui/PartnerList'

const DEPT_CARD_COLORS: Record<PartnerDepartment, string> = {
  student_success:      'border-purple-200 hover:border-purple-400',
  career_development:   'border-teal-200 hover:border-teal-400',
  resourcefull:         'border-blue-200 hover:border-blue-400',
  funding_partnerships: 'border-green-200 hover:border-green-400',
  admissions:           'border-orange-200 hover:border-orange-400',
}

const DEPT_DESCRIPTIONS: Record<PartnerDepartment, string> = {
  student_success:     'Track student referrals and connected support orgs',
  career_development:  'Mentorship, apprenticeships, and guest speakers',
  resourcefull:        'Service provider outreach and onboarding pipeline',
  funding_partnerships:'Funders, grant history, and follow-up tracking',
  admissions:          'Referral partners and student intake coordination',
}

const DEPT_ROUTES: Record<PartnerDepartment, string> = {
  student_success:     '/instructor/partnerships/all?dept=student_success',
  career_development:  '/instructor/partnerships/all?dept=career_development',
  resourcefull:        '/instructor/partnerships/all?dept=resourcefull',
  funding_partnerships:'/instructor/partnerships/all?dept=funding_partnerships',
  admissions:          '/instructor/partnerships/all?dept=admissions',
}

const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as PartnerDepartment[]

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
}

export default async function PartnershipsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { partners } = await listPartners()

  const followUpCount = partners.filter(p => {
    const d = daysSince(p.last_interaction_date)
    return d !== null && d >= 30
  }).length

  // Count partners per department based on their department_status rows
  const deptCounts: Record<PartnerDepartment, number> = {
    student_success: 0,
    career_development: 0,
    resourcefull: 0,
    funding_partnerships: 0,
    admissions: 0,
  }
  for (const partner of partners) {
    const depts = new Set((partner.partner_department_status ?? []).map((s: { department: string }) => s.department))
    for (const dept of depts) {
      if (dept in deptCounts) deptCounts[dept as PartnerDepartment]++
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Partners</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-muted-text">{partners.length} organization{partners.length !== 1 ? 's' : ''} total</p>
              {followUpCount > 0 && (
                <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-red-100 text-red-700">
                  {followUpCount} need{followUpCount === 1 ? 's' : ''} follow-up
                </span>
              )}
            </div>
          </div>
          <Link
            href="/instructor/partnerships/new"
            className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
          >
            + Add Partner
          </Link>
        </div>

        {/* Department cards */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">Departments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_DEPARTMENTS.map(dept => {
              const count = deptCounts[dept]
              return (
                <Link
                  key={dept}
                  href={DEPT_ROUTES[dept]}
                  className={`rounded-xl border-2 bg-surface px-5 py-4 flex flex-col gap-2 hover:shadow-sm transition-all group ${DEPT_CARD_COLORS[dept]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${DEPT_COLORS[dept]}`}>
                      {DEPARTMENT_LABELS[dept]}
                    </span>
                    <span className="text-xs text-muted-text">{count} partner{count !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-sm text-dark-text">{DEPT_DESCRIPTIONS[dept]}</p>
                </Link>
              )
            })}
          </div>
        </section>

        {/* All partners list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-text uppercase tracking-wide">All Partners</h2>
            <div className="flex items-center gap-4">
              <Link href="/instructor/partnerships/map" className="text-xs text-teal-primary hover:underline">
                Map View →
              </Link>
              <Link href="/instructor/partnerships/referrals" className="text-xs text-teal-primary hover:underline">
                Student Referrals →
              </Link>
            </div>
          </div>

          {partners.length === 0 ? (
            <div className="text-center py-16 text-muted-text">
              <p className="text-lg font-medium mb-2">No partners yet</p>
              <p className="text-sm mb-6">Add your first organization to get started.</p>
              <Link href="/instructor/partnerships/new" className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors">
                Add Partner
              </Link>
            </div>
          ) : (
            <PartnerList partners={partners as Parameters<typeof PartnerList>[0]['partners']} />
          )}
        </section>
      </main>
    </div>
  )
}

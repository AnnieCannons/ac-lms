import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import { listPartners } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, type PartnerDepartment } from '@/lib/partner-constants'

const DEPT_COLORS: Record<PartnerDepartment, { card: string; badge: string; dot: string }> = {
  student_success:     { card: 'border-purple-200 hover:border-purple-400',  badge: 'bg-purple-100 text-purple-800',  dot: 'bg-purple-400' },
  career_development:  { card: 'border-teal-200 hover:border-teal-400',      badge: 'bg-teal-100 text-teal-800',      dot: 'bg-teal-400' },
  resourcefull:        { card: 'border-blue-200 hover:border-blue-400',       badge: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-400' },
  funding_partnerships:{ card: 'border-green-200 hover:border-green-400',    badge: 'bg-green-100 text-green-800',    dot: 'bg-green-400' },
  admissions:          { card: 'border-orange-200 hover:border-orange-400',  badge: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-400' },
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

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  in_onboarding: 'bg-blue-100 text-blue-800',
}

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  in_onboarding: 'In Onboarding',
}

const TYPE_LABELS: Record<string, string> = {
  service_provider: 'Service Provider',
  corporate: 'Corporate',
  funder: 'Funder',
  advisory: 'Advisory',
  mentorship: 'Mentorship',
  apprenticeship: 'Apprenticeship',
  media: 'Media',
  admissions_referral: 'Admissions Referral',
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
            <h1 className="text-2xl font-bold text-dark-text">Partnerships</h1>
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
              const colors = DEPT_COLORS[dept]
              const count = deptCounts[dept]
              return (
                <Link
                  key={dept}
                  href={DEPT_ROUTES[dept]}
                  className={`rounded-xl border-2 bg-surface px-5 py-4 flex flex-col gap-2 hover:shadow-sm transition-all group ${colors.card}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${colors.badge}`}>
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
            <Link href="/instructor/partnerships/referrals" className="text-xs text-teal-primary hover:underline">
              Student Referrals →
            </Link>
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
            <div className="flex flex-col gap-3">
              {partners.map((partner) => {
                const types = (partner.partner_type_assignments ?? []).map(
                  (t: { partner_type: string }) => TYPE_LABELS[t.partner_type] ?? t.partner_type
                )
                const primaryContact = (partner.partner_contacts ?? []).find((c: { is_primary: boolean }) => c.is_primary)
                const deptStatuses = (partner.partner_department_status ?? []) as { department: PartnerDepartment; stage: string }[]
                const latest = partner.latest_interaction as unknown as {
                  note: string; interaction_date: string
                  department: PartnerDepartment | null; users: { name: string } | null
                } | null
                const daysAgo = daysSince(partner.last_interaction_date)
                const followUpNeeded = daysAgo !== null && daysAgo >= 30

                return (
                  <Link
                    key={partner.id}
                    href={`/instructor/partnerships/${partner.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-4 hover:border-teal-primary hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <p className="font-semibold text-dark-text group-hover:text-teal-primary transition-colors truncate">{partner.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
                          {partner.city && <span>{partner.city}{partner.state ? `, ${partner.state}` : ''}</span>}
                          {primaryContact && <><span className="text-muted-text/50">·</span><span>{primaryContact.name}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {followUpNeeded && <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-red-100 text-red-700">Follow-up</span>}
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_COLORS[partner.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[partner.status] ?? partner.status}
                        </span>
                      </div>
                    </div>

                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {types.map((t: string) => (
                          <span key={t} className="text-xs bg-background border border-border rounded px-1.5 py-0.5 text-muted-text">{t}</span>
                        ))}
                      </div>
                    )}

                    {deptStatuses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {deptStatuses.map(ds => (
                          <span key={ds.department} className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${DEPT_COLORS[ds.department]?.badge ?? 'bg-gray-100 text-gray-600'}`}>
                            {DEPARTMENT_LABELS[ds.department]}: {ds.stage}
                          </span>
                        ))}
                      </div>
                    )}

                    {latest ? (
                      <div className="flex items-start gap-2 text-xs text-muted-text border-t border-border pt-2.5">
                        <span className="shrink-0 font-medium text-dark-text/70">{formatDate(latest.interaction_date)}</span>
                        {latest.users?.name && <span className="shrink-0">by {latest.users.name}</span>}
                        {latest.department && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 ${DEPT_COLORS[latest.department]?.badge}`}>
                            {DEPARTMENT_LABELS[latest.department]}
                          </span>
                        )}
                        <span className="truncate text-muted-text/80">{latest.note}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-text/60 border-t border-border pt-2.5">No interactions logged</p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

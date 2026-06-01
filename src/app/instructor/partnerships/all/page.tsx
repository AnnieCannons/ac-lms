import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import { listPartners } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, type PartnerDepartment } from '@/lib/partner-constants'

const DEPT_COLORS: Record<PartnerDepartment, string> = {
  student_success: 'bg-purple-100 text-purple-800',
  career_development: 'bg-teal-100 text-teal-800',
  resourcefull: 'bg-blue-100 text-blue-800',
  funding_partnerships: 'bg-green-100 text-green-800',
  admissions: 'bg-orange-100 text-orange-800',
}

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

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

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

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-text">
            <p className="text-lg font-medium mb-2">No partners in {deptLabel} yet</p>
            <p className="text-sm mb-6">
              Open a partner record and add it to the <strong>{deptLabel}</strong> department from the Department Journey section.
            </p>
            <Link
              href="/instructor/partnerships"
              className="text-sm text-teal-primary hover:underline"
            >
              Go to all partners
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(partner => {
              const types = (partner.partner_type_assignments ?? []).map(
                (t: { partner_type: string }) => TYPE_LABELS[t.partner_type] ?? t.partner_type
              )
              const primaryContact = (partner.partner_contacts ?? []).find(
                (c: { is_primary: boolean }) => c.is_primary
              )
              const deptStatus = department
                ? (partner.partner_department_status ?? []).find(
                    (s: { department: string }) => s.department === department
                  )
                : null
              const latest = partner.latest_interaction as unknown as {
                note: string
                interaction_date: string
                department: PartnerDepartment | null
                users: { name: string } | null
              } | null

              return (
                <Link
                  key={partner.id}
                  href={`/instructor/partnerships/${partner.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-4 hover:border-teal-primary hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="font-semibold text-dark-text group-hover:text-teal-primary transition-colors truncate">
                        {partner.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
                        {partner.city && (
                          <span>{partner.city}{partner.state ? `, ${partner.state}` : ''}</span>
                        )}
                        {primaryContact && (
                          <><span className="text-muted-text/50">·</span><span>{primaryContact.name}</span></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {deptStatus?.stage && (
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${DEPT_COLORS[department!]}`}>
                          {deptStatus.stage}
                        </span>
                      )}
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

                  {latest ? (
                    <div className="flex items-start gap-2 text-xs text-muted-text border-t border-border pt-2.5">
                      <span className="shrink-0 font-medium text-dark-text/70">{formatDate(latest.interaction_date)}</span>
                      {latest.users?.name && <span className="shrink-0">by {latest.users.name}</span>}
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
      </main>
    </div>
  )
}

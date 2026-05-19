import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import { listPartners } from '@/lib/partner-actions'

const STATUS_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  in_onboarding: 'In Onboarding',
}

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  in_onboarding: 'bg-blue-100 text-blue-800',
}

const TYPE_LABELS: Record<string, string> = {
  service_provider: 'Service Provider',
  corporate: 'Corporate',
  funder: 'Funder',
  advisory: 'Advisory',
  mentorship: 'Mentorship',
  media: 'Media',
}

export default async function PartnershipsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { partners } = await listPartners()

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Partnerships</h1>
            <p className="text-sm text-muted-text mt-1">{partners.length} organization{partners.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/instructor/partnerships/new"
            className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
          >
            + Add Partner
          </Link>
        </div>

        {partners.length === 0 ? (
          <div className="text-center py-20 text-muted-text">
            <p className="text-lg font-medium mb-2">No partners yet</p>
            <p className="text-sm mb-6">Add your first organization to get started.</p>
            <Link
              href="/instructor/partnerships/new"
              className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
            >
              Add Partner
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {partners.map((partner) => {
              const types = (partner.partner_type_assignments ?? []).map(
                (t: { partner_type: string }) => TYPE_LABELS[t.partner_type] ?? t.partner_type
              )
              const primaryContact = (partner.partner_contacts ?? []).find(
                (c: { is_primary: boolean }) => c.is_primary
              )

              return (
                <Link
                  key={partner.id}
                  href={`/instructor/partnerships/${partner.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 hover:border-teal-primary hover:shadow-sm transition-all group"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="font-semibold text-dark-text group-hover:text-teal-primary transition-colors truncate">
                      {partner.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
                      {partner.city && (
                        <span>{partner.city}{partner.state ? `, ${partner.state}` : ''}</span>
                      )}
                      {primaryContact && (
                        <span className="text-muted-text/60">·</span>
                      )}
                      {primaryContact && (
                        <span>{primaryContact.name}</span>
                      )}
                    </div>
                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {types.map((t: string) => (
                          <span key={t} className="text-xs bg-surface border border-border rounded px-1.5 py-0.5 text-muted-text">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`ml-4 shrink-0 text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_COLORS[partner.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[partner.status] ?? partner.status}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

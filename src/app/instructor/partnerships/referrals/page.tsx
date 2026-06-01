import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import ReferralDashboard from '@/components/ui/ReferralDashboard'
import { listReferrals } from '@/lib/partner-interactions-actions'
import { listPartnersWithGeo } from '@/lib/partner-actions'

export default async function ReferralsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const [{ referrals }, { partners: rawPartners }] = await Promise.all([
    listReferrals(),
    listPartnersWithGeo(),
  ])

  const partnerOptions = rawPartners.map(p => ({
    id: p.id,
    name: p.name,
    city: p.city ?? null,
    state: p.state ?? null,
    multi_city: p.multi_city ?? false,
    services_focus_area: p.services_focus_area ?? null,
    partner_types: (p.partner_type_assignments ?? []).map((t: { partner_type: string }) => t.partner_type),
  }))

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/instructor/partnerships" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← Partnerships
          </Link>
          <h1 className="text-2xl font-bold text-dark-text mt-3">Student Referrals</h1>
          <p className="text-sm text-muted-text mt-1">Track inbound and outbound referrals; log outcomes.</p>
        </div>

        <ReferralDashboard
          initialReferrals={referrals as Parameters<typeof ReferralDashboard>[0]['initialReferrals']}
          partners={partnerOptions}
        />
      </main>
    </div>
  )
}

import Link from 'next/link'
import ReferralDashboard from '@/components/ui/ReferralDashboard'
import { listReferrals } from '@/lib/partner-interactions-actions'
import { listPartners } from '@/lib/partner-actions'

export default async function ReferralsPage() {
  const [{ referrals }, { partners }] = await Promise.all([
    listReferrals(),
    listPartners(),
  ])

  const partnerOptions = partners.map(p => ({ id: p.id, name: p.name }))

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-text">Student Referrals</h1>
        <p className="text-sm text-muted-text mt-1">Track inbound and outbound referrals; log outcomes.</p>
      </div>

      <ReferralDashboard
        initialReferrals={referrals as Parameters<typeof ReferralDashboard>[0]['initialReferrals']}
        partners={partnerOptions}
      />
    </main>
  )
}

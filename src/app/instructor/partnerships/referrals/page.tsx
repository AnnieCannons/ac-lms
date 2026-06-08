import Link from 'next/link'
import ReferralDashboard from '@/components/ui/ReferralDashboard'
import { listReferrals } from '@/lib/partner-interactions-actions'
import { listPartnersWithGeo } from '@/lib/partner-actions'
import { listStudents } from '@/lib/partner-ratings-actions'

export default async function ReferralsPage() {
  const [{ referrals }, { partners: rawPartners }, { students }] = await Promise.all([
    listReferrals(),
    listPartnersWithGeo(),
    listStudents(),
  ])

  const partnerOptions = rawPartners
    .filter(p => {
      const depts = (p.partner_department_status ?? []).map((d: { department: string }) => d.department)
      const types = (p.partner_type_assignments ?? []).map((t: { partner_type: string }) => t.partner_type)
      return (
        depts.includes('admissions') ||
        depts.includes('resourcefull') ||
        depts.includes('student_success') ||
        types.includes('service_provider')
      )
    })
    .map(p => ({
      id: p.id,
      name: p.name,
      city: p.city ?? null,
      state: p.state ?? null,
      multi_city: p.multi_city ?? false,
      services_focus_area: p.services_focus_area ?? null,
      service_categories: (p.service_categories ?? []) as string[],
      partner_types: (p.partner_type_assignments ?? []).map((t: { partner_type: string }) => t.partner_type),
    }))

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Student Referrals</h1>
            <p className="text-sm text-muted-text mt-1">Find an org and log a referral; track outcomes and ratings.</p>
          </div>
          <Link
            href="/instructor/partnerships/referrals/submissions"
            className="text-xs text-teal-primary hover:underline"
          >
            Rating submissions →
          </Link>
        </div>
      </div>

      <ReferralDashboard
        initialReferrals={referrals as Parameters<typeof ReferralDashboard>[0]['initialReferrals']}
        partners={partnerOptions}
        students={students}
      />
    </main>
  )
}

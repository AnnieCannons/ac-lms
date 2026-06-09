import { listPartners } from '@/lib/partner-actions'
import EmailListBuilder from '@/components/ui/EmailListBuilder'
import BackLink from '@/components/ui/BackLink'

export default async function NewEmailListPage() {
  const { partners } = await listPartners()

  const partnerData = partners.map(p => ({
    id: p.id,
    name: p.name,
    city: p.city ?? null,
    state: p.state ?? null,
    status: p.status,
    partner_type_assignments: (p.partner_type_assignments ?? []) as { partner_type: string }[],
    partner_contacts: (p.partner_contacts ?? []).map((c: { id: string; name: string; email: string | null; is_primary: boolean; website_url?: string | null }) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      is_primary: c.is_primary,
      website_url: c.website_url ?? null,
    })),
    partner_department_status: (p.partner_department_status ?? []) as { department: string }[],
  }))

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <BackLink href="/instructor/partnerships/email-lists">Email Lists</BackLink>
        <h1 className="text-2xl font-bold text-dark-text mt-3">New Email List</h1>
        <p className="text-sm text-muted-text mt-1">
          Filter partners, review contacts, then copy or save the list.
        </p>
      </div>

      <EmailListBuilder partners={partnerData} />
    </main>
  )
}

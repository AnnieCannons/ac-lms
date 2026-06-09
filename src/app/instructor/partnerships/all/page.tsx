import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listPartners } from '@/lib/partner-actions'
import { DEPARTMENT_LABELS, DEPT_COLORS, type PartnerDepartment } from '@/lib/partner-constants'
import PartnerList, { type SortOption } from '@/components/ui/PartnerList'
import BackLink from '@/components/ui/BackLink'

interface Props {
  searchParams: Promise<{ dept?: string }>
}

export default async function DepartmentPartnersPage({ searchParams }: Props) {
  const { dept } = await searchParams

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
    <main className="max-w-4xl mx-auto px-6 py-10">

        <div className="mb-8">
          <BackLink href="/instructor/partnerships">Partners</BackLink>
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-dark-text">{deptLabel ?? 'All Partners'}</h1>
              {department && (
                <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${DEPT_COLORS[department]}`}>
                  {filtered.length} partner{filtered.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Link
                href={`/instructor/partnerships/map${department ? `?dept=${department}` : ''}`}
                className="text-xs text-teal-primary hover:underline"
              >
                Map View →
              </Link>
              <Link
                href={`/instructor/partnerships/new${department ? `?dept=${department}` : ''}`}
                className="px-3 py-1.5 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
              >
                + Add Partner
              </Link>
            </div>
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
          <PartnerList
            partners={filtered as unknown as Parameters<typeof PartnerList>[0]['partners']}
            department={department}
            sortOptions={
              department === 'admissions'      ? ['name', 'referrals_in', 'last_interaction'] :
              department === 'student_success' ? ['name', 'referrals_out', 'last_interaction'] :
              ['name', 'last_interaction']
            }
            showCategoryFilter={department === 'admissions' || department === 'resourcefull' || !department}
          />
        )}
    </main>
  )
}

import Link from 'next/link'
import { listEmailLists } from '@/lib/email-list-actions'
import BackLink from '@/components/ui/BackLink'
import { DEPARTMENT_LABELS, type PartnerDepartment } from '@/lib/partner-constants'
import EmailListHistory from '@/components/ui/EmailListHistory'

const DEPT_BADGE: Record<string, string> = {
  student_success: 'bg-purple-100 text-purple-800',
  career_development: 'bg-teal-100 text-teal-800',
  resourcefull: 'bg-blue-100 text-blue-800',
  funding_partnerships: 'bg-green-100 text-green-800',
  admissions: 'bg-orange-100 text-orange-800',
}

export default async function EmailListsPage() {
  const { lists } = await listEmailLists()

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <BackLink href="/instructor/partnerships">Partners</BackLink>
        <div className="flex items-center justify-between mt-3 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Email Lists</h1>
            <p className="text-sm text-muted-text mt-1">
              Build filtered contact lists and track email outreach history.
            </p>
          </div>
          <Link
            href="/instructor/partnerships/email-lists/new"
            className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
          >
            + New Email List
          </Link>
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-20 text-muted-text">
          <p className="text-lg font-medium mb-2">No email lists yet</p>
          <p className="text-sm mb-6">Build a filtered list of partner contacts to copy and send.</p>
          <Link
            href="/instructor/partnerships/email-lists/new"
            className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
          >
            Create First List
          </Link>
        </div>
      ) : (
        <EmailListHistory
          lists={lists as Parameters<typeof EmailListHistory>[0]['lists']}
          deptBadge={DEPT_BADGE}
          deptLabels={DEPARTMENT_LABELS as Record<string, string>}
        />
      )}
    </main>
  )
}

import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import NavMobileMenu from '@/components/ui/NavMobileMenu'
import DocsHelpLink from '@/components/ui/DocsHelpLink'

const ATTENDANCE_URL = 'https://ac-student-portal.vercel.app/'

export interface Breadcrumb {
  label: string
  href?: string
}

export default function InstructorTopNav({ name, role, isTa, breadcrumbs }: { name?: string | null; role?: string | null; isTa?: boolean; breadcrumbs?: Breadcrumb[] }) {
  const displayRole = isTa ? 'TA' : role
  return (
    <nav aria-label="Primary navigation" className="sticky top-0 z-40 bg-surface border-b border-border px-4 sm:px-8 py-4 flex items-center gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/instructor/courses" aria-label="AC — Home" className="text-xl font-extrabold text-dark-text">
          AC<span aria-hidden="true" className="text-teal-primary">*</span>
        </Link>
        {displayRole && (
          <span className="text-xs font-semibold text-teal-primary bg-teal-light px-2 py-0.5 rounded-full capitalize">
            {displayRole}
          </span>
        )}
      </div>

      {/* Breadcrumb — center */}
      <nav aria-label="Breadcrumb" className="flex-1 flex items-center gap-1 min-w-0 overflow-hidden">
        {(breadcrumbs ?? []).map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <span aria-hidden="true" className="text-border shrink-0 select-none">›</span>}
            {crumb.href ? (
              <Link href={crumb.href} className="text-sm text-teal-primary hover:underline transition-colors truncate max-w-[180px]">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-sm text-dark-text font-medium truncate max-w-[200px]">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Desktop right side */}
      <div className="hidden sm:flex items-center gap-5 shrink-0">
        <a
          href={ATTENDANCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-teal-primary hover:underline"
        >
          Attendance Portal<span className="sr-only"> (opens in new tab)</span>
        </a>
        <DocsHelpLink guide="instructor" className="text-sm text-muted-text hover:text-teal-primary transition-colors" />
        <Link href="/account" className="text-sm font-medium text-dark-text hover:text-teal-primary transition-colors">
          {name}
        </Link>
        <LogoutButton />
      </div>

      {/* Mobile hamburger */}
      <NavMobileMenu name={name} accountHref="/account" />
    </nav>
  )
}

import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import NavMobileMenu from '@/components/ui/NavMobileMenu'
import DocsHelpLink from '@/components/ui/DocsHelpLink'

const ATTENDANCE_URL = 'https://ac-student-portal.vercel.app/'

export default function StudentTopNav({ name, role }: { name?: string | null; role?: string | null }) {
  return (
    <nav aria-label="Primary navigation" className="bg-surface border-b border-border px-4 sm:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        {role && (
          <span className="text-xs font-semibold text-teal-primary bg-teal-light px-2 py-0.5 rounded-full capitalize">
            {role}
          </span>
        )}
      </div>

      {/* Desktop right side */}
      <div className="hidden sm:flex items-center gap-5">
        <a
          href={ATTENDANCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-teal-primary hover:underline"
        >
          Attendance Portal
        </a>
        <DocsHelpLink guide="student" className="text-sm text-muted-text hover:text-teal-primary transition-colors" />
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

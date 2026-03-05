import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

const ATTENDANCE_URL = 'https://ac-student-portal.vercel.app/'

export default function StudentTopNav({ name, role }: { name?: string | null; role?: string | null }) {
  return (
    <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
      <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
        AC<span className="text-teal-primary">*</span>
      </Link>
      <div className="flex items-center gap-5">
        <a
          href={ATTENDANCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-teal-primary hover:underline"
        >
          Attendance Portal
        </a>
        <span className="text-sm text-gray-500">
          {name} · <span className="text-teal-primary font-medium capitalize">{role}</span>
        </span>
        <LogoutButton />
      </div>
    </nav>
  )
}

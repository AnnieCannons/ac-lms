'use client'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import NotificationBell from '@/components/ui/NotificationBell'

type Props = {
  name?: string | null
  role?: string | null
}

export default function FlashcardAdminNav({ name, role }: Props) {
  return (
    <nav aria-label="Primary navigation" className="sticky top-0 z-40 bg-surface border-b border-border px-4 sm:px-8 py-4 flex items-center gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <Link href="/instructor" aria-label="AC — Home" className="text-xl font-extrabold text-dark-text">
          AC<span aria-hidden="true" className="text-teal-primary">*</span>
        </Link>
        {role && (
          <span className="text-xs font-semibold text-teal-primary bg-teal-light px-2 py-0.5 rounded-full capitalize">
            {role}
          </span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-5 shrink-0">
        <NotificationBell />
        <Link href="/account" className="text-sm font-medium text-dark-text hover:text-teal-primary transition-colors">
          {name}
        </Link>
        <LogoutButton />
      </div>
    </nav>
  )
}

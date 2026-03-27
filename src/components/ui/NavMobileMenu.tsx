'use client'
import { useState } from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

const ATTENDANCE_URL = 'https://ac-student-portal.vercel.app/'

export default function NavMobileMenu({ name, accountHref }: { name?: string | null; accountHref: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="flex flex-col justify-center gap-1.5 p-2 -mr-1"
      >
        <span className="block w-5 h-0.5 bg-dark-text rounded-full" />
        <span className="block w-5 h-0.5 bg-dark-text rounded-full" />
        <span className="block w-5 h-0.5 bg-dark-text rounded-full" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-xl shadow-lg z-50 py-2">
            <Link
              href="/student/confidence"
              className="block px-4 py-2.5 text-sm font-medium text-dark-text hover:bg-background"
              onClick={() => setOpen(false)}
            >
              Confidence Tracker
            </Link>
            <a
              href={ATTENDANCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2.5 text-sm font-medium text-dark-text hover:bg-background"
              onClick={() => setOpen(false)}
            >
              Attendance Portal
            </a>
            <Link
              href={accountHref}
              className="block px-4 py-2.5 text-sm font-medium text-dark-text hover:bg-background"
              onClick={() => setOpen(false)}
            >
              {name ?? 'Profile'}
            </Link>
            <div className="px-4 py-2.5">
              <LogoutButton />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import NavMobileMenu from '@/components/ui/NavMobileMenu'
import DocsHelpLink from '@/components/ui/DocsHelpLink'

const ATTENDANCE_URL = 'https://ac-student-portal.vercel.app/'

function ToolsDropdown() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="text-sm font-medium text-teal-primary hover:underline flex items-center gap-1"
      >
        Tools
        <span aria-hidden="true" className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-xl shadow-lg z-50 py-2">
            <Link
              href="/student/confidence"
              className="block px-4 py-2.5 text-sm font-medium text-dark-text hover:bg-background hover:text-teal-primary transition-colors"
              onClick={() => setOpen(false)}
            >
              Confidence Tracker
            </Link>
            <a
              href={ATTENDANCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2.5 text-sm font-medium text-dark-text hover:bg-background hover:text-teal-primary transition-colors"
              onClick={() => setOpen(false)}
            >
              Attendance Portal<span className="sr-only"> (opens in new tab)</span>
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export default function StudentTopNav({ name, role }: { name?: string | null; role?: string | null }) {
  return (
    <nav aria-label="Primary navigation" className="sticky top-0 z-40 bg-surface border-b border-border px-4 sm:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/student/courses" aria-label="AC — Home" className="text-xl font-extrabold text-dark-text">
          AC<span aria-hidden="true" className="text-teal-primary">*</span>
        </Link>
        {role && (
          <span className="text-xs font-semibold text-teal-primary bg-teal-light px-2 py-0.5 rounded-full capitalize">
            {role}
          </span>
        )}
      </div>

      {/* Desktop right side */}
      <div className="hidden sm:flex items-center gap-5">
        <ToolsDropdown />
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

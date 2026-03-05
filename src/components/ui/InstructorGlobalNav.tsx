'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const ITEMS = [
  { label: 'Calendar', href: '/instructor/calendar' },
  { label: 'Computer and Wifi', href: '/instructor/globals/computer-wifi' },
  { label: 'Policies and Procedures', href: '/instructor/globals/policies' },
]

export default function InstructorGlobalNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Global navigation" className="flex flex-col">
      <p className="text-xs font-bold text-muted-text uppercase tracking-widest mb-4 px-3">
        Global Templates
      </p>
      <div className="flex flex-col gap-0.5">
        {ITEMS.map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === href
                ? 'bg-teal-light text-teal-primary'
                : 'text-muted-text hover:text-dark-text hover:bg-border/20'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

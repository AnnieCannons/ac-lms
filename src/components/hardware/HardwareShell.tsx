import Link from 'next/link'
import InstructorTopNav, { type Breadcrumb } from '@/components/ui/InstructorTopNav'
import type { HardwareViewer } from '@/lib/hardware-access'

export type HardwareSection = 'devices' | 'students' | 'attention' | 'waitlist' | 'checkin' | 'receive' | 'guide'

const SECTIONS: { key: HardwareSection; label: string; href: string; manageOnly?: boolean }[] = [
  { key: 'devices', label: 'Devices', href: '/instructor/hardware' },
  { key: 'students', label: 'Students', href: '/instructor/hardware?tab=students' },
  { key: 'attention', label: 'Needs attention', href: '/instructor/hardware?tab=attention' },
  { key: 'waitlist', label: 'Waitlist', href: '/instructor/hardware?tab=waitlist', manageOnly: true },
  { key: 'checkin', label: 'Check-in', href: '/instructor/hardware/check-in', manageOnly: true },
  { key: 'receive', label: 'Mark received', href: '/instructor/hardware/receive' },
  { key: 'guide', label: 'How do I…?', href: '/instructor/hardware/guide' },
]

/**
 * Shared chrome for the Hardware Tracker pages. A standalone area reached from the
 * /instructor dashboard (like Partners), so no course or Global Templates sidebar; instead
 * every page has the same section bar, so nothing needs the browser's Back button.
 */
export default function HardwareShell({
  viewer,
  breadcrumbs,
  active,
  children,
}: {
  viewer: HardwareViewer
  breadcrumbs?: Breadcrumb[]
  /** Which section this page belongs to (highlighted in the bar). */
  active?: HardwareSection
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={viewer.name} role={viewer.role} isTa={!viewer.canManage} breadcrumbs={breadcrumbs} />
      <nav aria-label="Hardware" className="border-b border-border bg-surface print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 flex gap-1 overflow-x-auto">
          {SECTIONS.filter(s => viewer.canManage || !s.manageOnly).map(s => (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active === s.key ? 'page' : undefined}
              className={`whitespace-nowrap px-3 py-3 text-sm font-semibold border-b-2 -mb-px ${
                active === s.key ? 'border-teal-primary text-teal-primary' : 'border-transparent text-muted-text hover:text-dark-text'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </nav>
      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-8 py-10 focus:outline-none">
        {children}
      </main>
    </div>
  )
}

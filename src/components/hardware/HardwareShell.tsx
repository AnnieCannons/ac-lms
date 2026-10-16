import InstructorTopNav, { type Breadcrumb } from '@/components/ui/InstructorTopNav'
import type { HardwareViewer } from '@/lib/hardware-access'

/**
 * Shared chrome for the Hardware Tracker pages. A standalone area reached from the
 * /instructor dashboard (like Partners), so it has no course or Global Templates sidebar.
 */
export default function HardwareShell({
  viewer,
  breadcrumbs,
  children,
}: {
  viewer: HardwareViewer
  breadcrumbs?: Breadcrumb[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={viewer.name} role={viewer.role} breadcrumbs={breadcrumbs} />
      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-8 py-10 focus:outline-none">
        {children}
      </main>
    </div>
  )
}

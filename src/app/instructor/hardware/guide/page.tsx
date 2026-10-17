import Link from 'next/link'
import { getHardwareViewer } from '@/lib/hardware-access'
import HardwareShell from '@/components/hardware/HardwareShell'
import HardwareGuide from '@/components/hardware/HardwareGuide'

/** Step-by-step answers to common hardware situations. */
export default async function HardwareGuidePage() {
  const viewer = await getHardwareViewer()
  return (
    <HardwareShell viewer={viewer} active="guide" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'How do I…?' }]}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-dark-text">How do I…?</h1>
        <p className="text-sm text-muted-text mt-1 mb-8">
          Pick the situation you&apos;re in for step-by-step instructions. For how everything works in more detail, see{' '}
          <Link href="/docs/instructor/hardware" className="font-semibold text-teal-primary hover:underline">Help → Hardware</Link>.
        </p>
        {!viewer.canManage && (
          <p className="text-sm bg-surface border border-border rounded-xl px-4 py-3 mb-8 text-dark-text">
            As a TA you can loan devices, mark things received, mark needs prep, update support tickets and add notes. For
            anything else in these steps, ask an instructor or staff member.
          </p>
        )}
        <HardwareGuide />
      </div>
    </HardwareShell>
  )
}

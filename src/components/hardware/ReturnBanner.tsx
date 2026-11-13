import Link from 'next/link'
import { KIND_LABELS, type HardwareDevice } from '@/lib/hardware'

/** Top-of-page reminder for a student who has equipment we need back. */
export default function ReturnBanner({ devices }: { devices: HardwareDevice[] }) {
  if (devices.length === 0) return null
  const list = devices.map(d => `${KIND_LABELS[d.kind].toLowerCase()} (${d.asset_tag})`).join(', ')
  return (
    <div role="status" className="badge-amber border rounded-xl px-4 py-3 mb-6 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
      <span><strong>Please send back your {list}.</strong> AnnieCannons needs {devices.length === 1 ? 'it' : 'them'} returned.</span>
      <Link href="/account#equipment" className="font-semibold underline">See details</Link>
    </div>
  )
}

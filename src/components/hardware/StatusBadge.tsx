import { STATUS_LABELS, type DeviceStatus } from '@/lib/hardware'

const TONE: Partial<Record<DeviceStatus, string>> = {
  awaiting_return: 'badge-amber',
  needs_repair: 'badge-orange',
  needs_prep: 'badge-amber',
  lost: 'badge-orange',
}

export default function StatusBadge({ status }: { status: DeviceStatus }) {
  const tone = TONE[status] ?? 'border-border text-muted-text'
  return (
    <span className={`inline-block whitespace-nowrap text-[11px] font-semibold border rounded-full px-2 py-0.5 ${tone}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

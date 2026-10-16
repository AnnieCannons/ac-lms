import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadBatch, loadDevice, loadDeviceEvents, loadPeople } from '@/lib/hardware-server'
import { CONDITION_LABELS, deviceToInput, formatDateOnly, KIND_LABELS } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import StatusBadge from '@/components/hardware/StatusBadge'
import HistoryTimeline from '@/components/hardware/HistoryTimeline'
import DeviceForm from '@/components/hardware/DeviceForm'
import DeviceActions from '@/components/hardware/DeviceActions'

export default async function DevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const viewer = await getHardwareViewer()
  const { deviceId } = await params
  const admin = createServiceSupabaseClient()
  const device = await loadDevice(admin, deviceId)
  if (!device) notFound()

  const [events, batch] = await Promise.all([loadDeviceEvents(admin, device.id), loadBatch(admin, device.purchase_batch_id)])
  const people = await loadPeople(admin, [device.current_holder_id, ...events.flatMap(e => [e.actor_id, e.student_id])])
  const holder = device.current_holder_id ? people.get(device.current_holder_id) : null

  return (
    <HardwareShell viewer={viewer} breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: device.asset_tag ?? 'Device' }]}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-text uppercase tracking-widest">{KIND_LABELS[device.kind]}</p>
          <h1 className="text-2xl font-bold text-dark-text">{device.asset_tag}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
            <StatusBadge status={device.status} />
            {holder && (
              <span className="text-muted-text">
                with <Link href={`/instructor/hardware/students/${holder.id}`} className="text-teal-primary hover:underline">{holder.name ?? holder.email}</Link>
              </span>
            )}
          </div>
        </div>
        <Link href={`/instructor/hardware/labels?device=${device.id}`} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
          Print label
        </Link>
      </div>

      {batch && (
        <p className="text-sm text-muted-text mb-6">
          From <Link href={`/instructor/hardware/purchases/${batch.id}`} className="text-teal-primary hover:underline">
            a purchase{batch.purchased_on ? ` on ${formatDateOnly(batch.purchased_on)}` : ''}{batch.vendor ? ` from ${batch.vendor}` : ''}
          </Link>
          {batch.condition ? ` · ${CONDITION_LABELS[batch.condition as keyof typeof CONDITION_LABELS] ?? batch.condition}` : ''}
          {batch.warranty_ends_on ? ` · warranty until ${formatDateOnly(batch.warranty_ends_on)}` : ''}
        </p>
      )}

      <div className="grid lg:grid-cols-[3fr_2fr] gap-8 items-start">
        <div className="flex flex-col gap-8 min-w-0">
          <section>
            <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Details</h2>
            <DeviceForm deviceId={device.id} initial={deviceToInput(device)} />
          </section>
          <section>
            <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">History</h2>
            <HistoryTimeline events={events} people={people} />
          </section>
        </div>
        <DeviceActions deviceId={device.id} status={device.status} withStudent={!!device.current_holder_id} />
      </div>
    </HardwareShell>
  )
}

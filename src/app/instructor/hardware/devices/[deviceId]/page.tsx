import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadBatch, loadDevice, loadDeviceEvents, loadOpenReturnForDevice, loadPeople } from '@/lib/hardware-server'
import {
  CONDITION_LABELS,
  daysSince,
  isLikelyLost,
  KIND_LABELS,
  primaryIdentifier,
} from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import HistoryTimeline from '@/components/hardware/HistoryTimeline'
import DeviceDetails from '@/components/hardware/DeviceDetails'
import StatusControl from '@/components/hardware/StatusControl'
import AddNoteButton from '@/components/hardware/AddNoteButton'
import Card from '@/components/hardware/Card'

export default async function DevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const viewer = await getHardwareViewer()
  const { deviceId } = await params
  const admin = createServiceSupabaseClient()
  const device = await loadDevice(admin, deviceId)
  if (!device) notFound()

  const [events, batch, openReturn] = await Promise.all([
    loadDeviceEvents(admin, device.id),
    loadBatch(admin, device.purchase_batch_id),
    loadOpenReturnForDevice(admin, device.id),
  ])
  const people = await loadPeople(admin, [device.current_holder_id, ...events.flatMap(e => [e.actor_id, e.student_id])])
  const holder = device.current_holder_id ? people.get(device.current_holder_id) : null

  const summary = [
    device.make_model,
    device.model_year != null ? String(device.model_year) : null,
    device.condition ? CONDITION_LABELS[device.condition] : null,
  ].filter(Boolean).join(' · ')
  const identifier = primaryIdentifier(device)
  const waitingDays = openReturn ? daysSince(openReturn.requested_at) : null

  return (
    <HardwareShell viewer={viewer} breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: device.asset_tag ?? 'Device' }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <section className="bg-surface rounded-2xl border border-border">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-widest">{KIND_LABELS[device.kind]}</p>
              <h1 className="text-2xl font-bold text-dark-text leading-tight">{device.asset_tag}</h1>
              {summary && <p className="text-base text-dark-text mt-1">{summary}</p>}
              {identifier && <p className="font-mono text-xs text-muted-text mt-1 break-all">{identifier}</p>}
            </div>
            <Link
              href={`/instructor/hardware/labels?device=${device.id}`}
              className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border border-border text-dark-text hover:bg-border/20"
            >
              Print label
            </Link>
          </div>
          <div className="border-t border-border px-5 py-4 flex flex-col gap-2">
            <StatusControl device={device} />
            {(holder || waitingDays != null) && (
              <p className="text-sm text-muted-text">
                {holder && (
                  <>With <Link href={`/instructor/hardware/students/${holder.id}`} className="text-teal-primary hover:underline">{holder.name ?? holder.email}</Link></>
                )}
                {waitingDays != null && (
                  <span className={openReturn && isLikelyLost(openReturn.requested_at) ? 'text-red-600 font-semibold' : ''}>
                    {holder ? ' · ' : ''}waiting {waitingDays} {waitingDays === 1 ? 'day' : 'days'}
                  </span>
                )}
              </p>
            )}
          </div>
        </section>

        <DeviceDetails device={device} batch={batch} />

        <Card title="History" action={<AddNoteButton deviceId={device.id} />}>
          <HistoryTimeline events={events} people={people} />
        </Card>
      </div>
    </HardwareShell>
  )
}

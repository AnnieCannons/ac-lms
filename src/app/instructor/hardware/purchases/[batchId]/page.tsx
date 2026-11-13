import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { DEVICE_COLUMNS, loadBatch, loadPeople } from '@/lib/hardware-server'
import { CONDITION_LABELS, formatDateOnly, KIND_LABELS, type HardwareDevice } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import DeviceTable from '@/components/hardware/DeviceTable'

export default async function PurchasePage({ params }: { params: Promise<{ batchId: string }> }) {
  const viewer = await getHardwareViewer()
  const { batchId } = await params
  const admin = createServiceSupabaseClient()
  const batch = await loadBatch(admin, batchId)
  if (!batch) notFound()

  const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('purchase_batch_id', batch.id).order('asset_tag')
  const devices = (data as HardwareDevice[] | null) ?? []
  const people = await loadPeople(admin, devices.map(d => d.current_holder_id))

  const facts: [string, string | null][] = [
    ['Type', KIND_LABELS[batch.kind]],
    ['Make and model', batch.make_model],
    ['Year', batch.model_year ? String(batch.model_year) : null],
    ['Condition', batch.condition ? CONDITION_LABELS[batch.condition as keyof typeof CONDITION_LABELS] ?? batch.condition : null],
    ['Vendor', batch.vendor],
    ['Purchase date', formatDateOnly(batch.purchased_on) || null],
    ['Cost per device', batch.unit_cost != null ? `$${Number(batch.unit_cost).toFixed(2)}` : null],
    ['Warranty ends', formatDateOnly(batch.warranty_ends_on) || null],
  ]

  return (
    <HardwareShell viewer={viewer} active="devices" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Purchase' }]}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">
            {devices.length} {KIND_LABELS[batch.kind].toLowerCase()}{devices.length === 1 ? '' : 's'}
            {batch.make_model ? ` · ${batch.make_model}` : ''}
          </h1>
          {batch.notes && <p className="text-sm text-muted-text mt-1 whitespace-pre-line">{batch.notes}</p>}
        </div>
        <Link href={`/instructor/hardware/labels?batch=${batch.id}`} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90">
          Print labels
        </Link>
      </div>
      <dl className="grid sm:grid-cols-4 gap-4 bg-surface rounded-2xl border border-border p-5 mb-8">
        {facts.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold text-muted-text">{k}</dt>
            <dd className="text-sm text-dark-text">{v}</dd>
          </div>
        ))}
      </dl>
      <DeviceTable devices={devices} people={people} />
    </HardwareShell>
  )
}

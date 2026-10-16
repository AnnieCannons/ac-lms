import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { DEVICE_COLUMNS } from '@/lib/hardware-server'
import { KIND_LABELS, primaryIdentifier, type HardwareDevice } from '@/lib/hardware'
import PrintButton from '@/components/hardware/PrintButton'

const UUID = /^[0-9a-f-]{36}$/i

/** Printable asset-tag labels for one purchase (?batch=) or one device (?device=). */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ batch?: string; device?: string }> }) {
  await getHardwareViewer()
  const { batch, device } = await searchParams
  const admin = createServiceSupabaseClient()

  let devices: HardwareDevice[] = []
  if (batch && UUID.test(batch)) {
    const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('purchase_batch_id', batch).order('asset_tag')
    devices = (data as HardwareDevice[] | null) ?? []
  } else if (device && UUID.test(device)) {
    const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('id', device)
    devices = (data as HardwareDevice[] | null) ?? []
  }
  const back = batch ? `/instructor/hardware/purchases/${batch}` : device ? `/instructor/hardware/devices/${device}` : '/instructor/hardware'

  return (
    <main id="main-content" className="min-h-screen bg-background p-6 print:p-0 print:bg-white">
      <div className="print:hidden flex flex-wrap items-center gap-3 mb-6">
        <Link href={back} className="text-sm text-teal-primary hover:underline">← Back</Link>
        <PrintButton />
        <p className="text-sm text-muted-text">{devices.length} {devices.length === 1 ? 'label' : 'labels'}. Print on plain paper or label sheets and cut along the borders.</p>
      </div>
      {devices.length === 0 ? <p className="text-sm text-muted-text">No devices to print.</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:grid-cols-3 print:gap-0">
          {devices.map(d => (
            <div key={d.id} className="border border-dashed border-border print:border-black rounded-md print:rounded-none p-3 bg-white text-black break-inside-avoid">
              <p className="text-[10px] uppercase tracking-widest">AnnieCannons · {KIND_LABELS[d.kind]}</p>
              <p className="text-2xl font-bold font-mono leading-tight">{d.asset_tag}</p>
              {primaryIdentifier(d) && <p className="text-[10px] font-mono break-all">{primaryIdentifier(d)}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

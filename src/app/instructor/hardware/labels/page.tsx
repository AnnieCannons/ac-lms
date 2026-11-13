import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { DEVICE_COLUMNS, loadDevices } from '@/lib/hardware-server'
import {
  DEVICE_KINDS,
  DEVICE_STATUSES,
  KIND_LABELS,
  primaryIdentifier,
  type DeviceKind,
  type DeviceStatus,
  type HardwareDevice,
} from '@/lib/hardware'
import PrintButton from '@/components/hardware/PrintButton'

const UUID = /^[0-9a-f-]{36}$/i

// Avery 5160 / 8160 layout (also sold as "1 x 2-5/8 inch, 30 per sheet" address labels):
// letter paper, 3 columns x 10 rows, 1" x 2.625" labels, 0.5" top margin,
// 0.1875" side margins, 0.125" between columns, no gap between rows.
const PER_SHEET = 30
const SHEET_STYLE = {
  width: '8.5in',
  height: '11in',
  padding: '0.5in 0.1875in',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 2.625in)',
  gridAutoRows: '1in',
  columnGap: '0.125in',
  boxSizing: 'border-box' as const,
}

/**
 * Printable asset-tag labels on a standard 30-per-sheet label sheet. Which devices:
 * ?batch= (a purchase), ?device= (one), ?ids= (picked on the Devices list), or the Devices
 * list filters (?kind=&status=&q=). ?start= skips used labels on a partly used sheet.
 */
export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; device?: string; ids?: string; kind?: string; status?: string; q?: string; start?: string }>
}) {
  await getHardwareViewer()
  const params = await searchParams
  const admin = createServiceSupabaseClient()

  let devices: HardwareDevice[] = []
  let back = '/instructor/hardware'
  if (params.batch && UUID.test(params.batch)) {
    const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('purchase_batch_id', params.batch).order('asset_tag')
    devices = (data as HardwareDevice[] | null) ?? []
    back = `/instructor/hardware/purchases/${params.batch}`
  } else if (params.device && UUID.test(params.device)) {
    const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('id', params.device)
    devices = (data as HardwareDevice[] | null) ?? []
    back = `/instructor/hardware/devices/${params.device}`
  } else if (params.ids) {
    const ids = params.ids.split(',').filter(id => UUID.test(id)).slice(0, 300)
    if (ids.length) {
      const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).in('id', ids).order('asset_tag')
      devices = (data as HardwareDevice[] | null) ?? []
    }
  } else if (params.kind || params.status || params.q) {
    const kind = DEVICE_KINDS.includes(params.kind as DeviceKind) ? (params.kind as DeviceKind) : undefined
    const status = DEVICE_STATUSES.includes(params.status as DeviceStatus) ? (params.status as DeviceStatus) : undefined
    devices = await loadDevices(admin, { kind, status, q: params.q })
    back = `/instructor/hardware?${new URLSearchParams(Object.entries({ kind: params.kind, status: params.status, q: params.q }).filter(([, v]) => v) as [string, string][])}`
  }

  const start = Math.min(PER_SHEET, Math.max(1, Number(params.start) || 1))
  const cells: (HardwareDevice | null)[] = [...Array(start - 1).fill(null), ...devices]
  const sheets: (HardwareDevice | null)[][] = []
  for (let i = 0; i < cells.length; i += PER_SHEET) sheets.push(cells.slice(i, i + PER_SHEET))

  // Keep every other param when changing the start position.
  const keep = Object.entries(params).filter(([k, v]) => k !== 'start' && v) as [string, string][]

  return (
    <main id="main-content" className="min-h-screen bg-background p-6 print:p-0 print:bg-white">
      <style>{'@page { size: letter; margin: 0 } @media print { html, body { background: white !important } }'}</style>

      <div className="print:hidden max-w-[8.5in] mx-auto mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={back} className="text-sm text-teal-primary hover:underline">← Back</Link>
          <h1 className="text-xl font-bold text-dark-text">
            {devices.length} {devices.length === 1 ? 'label' : 'labels'} · {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
          </h1>
          <div className="ml-auto"><PrintButton /></div>
        </div>

        <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
          {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <label htmlFor="start" className="text-dark-text">Using a sheet that&apos;s already been used? Start at label</label>
          <select id="start" name="start" defaultValue={String(start)} className="px-2 py-1 rounded-lg border border-border bg-background text-dark-text">
            {Array.from({ length: PER_SHEET }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
          <button type="submit" className="text-sm font-semibold px-3 py-1 rounded-full border border-border text-dark-text hover:bg-border/20">Update</button>
          <span className="text-xs text-muted-text">(counting across, left to right, from the top-left label)</span>
        </form>

        <details className="rounded-xl border border-border bg-surface p-4 text-sm text-dark-text">
          <summary className="font-semibold cursor-pointer">Which labels to buy and how to print</summary>
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="font-semibold">Labels</p>
              <p className="text-muted-text mt-1">
                Any <strong className="text-dark-text">1&quot; × 2-5/8&quot;, 30-per-sheet</strong> address labels on letter paper. For example
                Avery <strong className="text-dark-text">5160</strong> (laser printers), Avery <strong className="text-dark-text">8160</strong> (inkjet printers),
                or Amazon Basics 1&quot; × 2-5/8&quot; address labels. Store brands that say &ldquo;compatible with Avery 5160&rdquo; work too.
                Match the label to your printer type (laser or inkjet).
              </p>
            </div>
            <div>
              <p className="font-semibold">Print settings</p>
              <ul className="list-disc pl-5 text-muted-text mt-1 flex flex-col gap-0.5">
                <li>Paper size: <strong className="text-dark-text">Letter</strong></li>
                <li>Scale: <strong className="text-dark-text">100% / Actual size</strong> (not &ldquo;Fit to page&rdquo;)</li>
                <li>Margins: <strong className="text-dark-text">None</strong> or Default</li>
                <li>Turn <strong className="text-dark-text">off</strong> headers and footers</li>
              </ul>
              <p className="text-muted-text mt-1">Tip: print one page on plain paper first and hold it against a label sheet to check it lines up.</p>
            </div>
            <div>
              <p className="font-semibold">On the device</p>
              <p className="text-muted-text mt-1">Labels are paper. A strip of clear packing tape over the label keeps it from scuffing on devices that travel back and forth.</p>
            </div>
          </div>
        </details>
      </div>

      {devices.length === 0 ? (
        <p className="print:hidden max-w-[8.5in] mx-auto text-sm text-muted-text">No devices to print.</p>
      ) : (
        <div className="flex flex-col items-center gap-6 print:gap-0 overflow-x-auto">
          {sheets.map((sheet, s) => (
            <div
              key={s}
              style={{ ...SHEET_STYLE, breakAfter: s < sheets.length - 1 ? 'page' : 'auto' }}
              className="bg-white text-black shadow-md print:shadow-none shrink-0"
              aria-label={`Sheet ${s + 1}`}
            >
              {sheet.map((d, i) => (
                <div
                  key={i}
                  className="overflow-hidden flex flex-col justify-center px-[0.15in] outline outline-1 outline-dashed outline-gray-300 print:outline-none"
                >
                  {d && (
                    <>
                      <p className="text-[7pt] uppercase tracking-widest leading-tight">AnnieCannons · {KIND_LABELS[d.kind]}</p>
                      <p className="text-[18pt] font-bold font-mono leading-none my-[0.03in]">{d.asset_tag}</p>
                      {primaryIdentifier(d) && <p className="text-[7pt] font-mono leading-tight truncate">{primaryIdentifier(d)}</p>}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

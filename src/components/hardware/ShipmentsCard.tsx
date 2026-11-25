'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markShipmentArrived, updateShipment } from '@/lib/hardware-shipping-actions'
import { formatDateOnly } from '@/lib/hardware'
import { CARRIERS, CARRIER_LABELS, trackingUrl, type Carrier, type Shipment } from '@/lib/hardware-shipping'
import { inputCls, labelCls } from './DeviceForm'
import Card from './Card'

function TrackingLink({ shipment }: { shipment: Pick<Shipment, 'carrier' | 'tracking_number'> }) {
  const url = trackingUrl(shipment.carrier, shipment.tracking_number)
  const text = `${CARRIER_LABELS[shipment.carrier]} ${shipment.tracking_number}`
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-teal-primary hover:underline">{text}<span className="sr-only"> (opens in a new tab)</span></a>
    : <span className="font-mono">{text}</span>
}

function EditShipment({ shipment, onDone }: { shipment: Shipment; onDone: () => void }) {
  const router = useRouter()
  const [carrier, setCarrier] = useState<Carrier>(shipment.carrier)
  const [tracking, setTracking] = useState(shipment.tracking_number)
  const [shippedOn, setShippedOn] = useState(shipment.shipped_on)
  const [notes, setNotes] = useState(shipment.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await updateShipment(shipment.id, { carrier, trackingNumber: tracking, shippedOn, notes })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={save} className="mt-2 bg-background rounded-xl border border-border p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label className={labelCls}>Carrier
        <select className={`${inputCls} mt-1`} value={carrier} onChange={e => setCarrier(e.target.value as Carrier)}>
          {CARRIERS.map(c => <option key={c} value={c}>{CARRIER_LABELS[c]}</option>)}
        </select>
      </label>
      <label className={`${labelCls} sm:col-span-2`}>Tracking number
        <input className={`${inputCls} mt-1 font-mono`} value={tracking} onChange={e => setTracking(e.target.value)} required />
      </label>
      <label className={labelCls}>Shipped on
        <input type="date" className={`${inputCls} mt-1`} value={shippedOn} onChange={e => setShippedOn(e.target.value)} required />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>Note
        <input className={`${inputCls} mt-1`} value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
      {error && <p role="alert" className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-3 flex gap-2">
        <button type="submit" disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onDone} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Cancel</button>
      </div>
    </form>
  )
}

/** Boxes sent to a student, newest first, on the Hardware student page. */
export default function ShipmentsCard({
  shipments,
  deviceTags,
  people,
  canManage,
}: {
  shipments: Shipment[]
  deviceTags: Record<string, string>
  /** Names of whoever confirmed arrival */
  people: Record<string, string>
  canManage: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function arrived(id: string) {
    setBusy(id)
    setError(null)
    const res = await markShipmentArrived(id)
    setBusy(null)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  return (
    <Card title={`Shipments · ${shipments.length}`}>
      {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {shipments.map(s => (
          <li key={s.id} className="py-3 first:pt-0 last:pb-0 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold text-dark-text">{formatDateOnly(s.shipped_on)}</span>
              <TrackingLink shipment={s} />
              <span className="text-muted-text">{s.device_ids.map(id => deviceTags[id] ?? 'device').join(', ')}</span>
              <span className={`ml-auto text-xs font-semibold ${s.received_at ? 'text-green-700' : 'text-amber-700'}`}>
                {s.received_at
                  ? `Arrived ${new Date(s.received_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' })}${s.received_by && people[s.received_by] ? ` (${people[s.received_by]})` : ''}`
                  : 'On the way'}
              </span>
            </div>
            {s.notes && <p className="text-xs text-muted-text mt-0.5">{s.notes}</p>}
            <div className="flex gap-4 mt-1">
              {!s.received_at && (
                <button type="button" onClick={() => arrived(s.id)} disabled={busy === s.id} className="text-xs font-semibold text-teal-primary hover:underline disabled:opacity-60">
                  {busy === s.id ? 'Saving…' : 'Mark arrived'}
                </button>
              )}
              {canManage && editing !== s.id && (
                <button type="button" onClick={() => setEditing(s.id)} className="text-xs font-semibold text-teal-primary hover:underline">Fix tracking</button>
              )}
            </div>
            {editing === s.id && <EditShipment shipment={s} onDone={() => setEditing(null)} />}
          </li>
        ))}
      </ul>
    </Card>
  )
}

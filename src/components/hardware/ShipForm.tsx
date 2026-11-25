'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shipToStudent } from '@/lib/hardware-shipping-actions'
import { DEVICE_KINDS, KIND_LABELS, type DeviceKind, type HardwareDevice } from '@/lib/hardware'
import { CARRIERS, CARRIER_LABELS, deviceKindsNeeded, type Carrier, type StudentNeeds } from '@/lib/hardware-shipping'
import { inputCls, labelCls } from './DeviceForm'

const deviceLabel = (d: HardwareDevice) => [d.asset_tag, d.make_model, d.model_year].filter(Boolean).join(' · ')

/**
 * Ship a box to a student: choose the in-stock device(s) going in it (and/or ones already
 * loaned to them), the carrier and the Pirate Ship tracking number. Loans what needs
 * loaning and tells the student.
 */
export default function ShipForm({
  studentId,
  studentName,
  needs,
  inStock,
  unshipped,
  heldKinds,
  today,
  onDone,
  onCancel,
}: {
  studentId: string
  studentName: string
  needs: StudentNeeds
  /** In-stock devices nobody holds */
  inStock: HardwareDevice[]
  /** Devices the student already has that haven't gone out in a shipment */
  unshipped: HardwareDevice[]
  /** Every kind of device the student has right now (no picker is offered for these) */
  heldKinds: DeviceKind[]
  /** YYYY-MM-DD, Pacific */
  today: string
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  // One picker per device their needs call for that they don't already have
  const neededKinds = useMemo(() => deviceKindsNeeded(needs).filter(k => !heldKinds.includes(k)), [needs, heldKinds])
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState('')
  // Nothing they already have is ticked: devices handed over before shipping existed would
  // otherwise go out in every box.
  const [held, setHeld] = useState<Set<string>>(new Set())
  const [carrier, setCarrier] = useState<Carrier>('usps')
  const [tracking, setTracking] = useState('')
  const [shippedOn, setShippedOn] = useState(today)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = [...Object.values(picked), extra].filter(Boolean)
  const available = (kind: DeviceKind | null, keep: string) =>
    inStock.filter(d => (!kind || d.kind === kind) && (d.id === keep || !chosen.includes(d.id)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await shipToStudent({
      studentId,
      loanDeviceIds: chosen,
      heldDeviceIds: [...held],
      carrier,
      trackingNumber: tracking,
      shippedOn,
      notes,
    })
    setBusy(false)
    // Refresh either way, so a device someone else just took drops out of the lists
    router.refresh()
    if (!res.ok) { setError(res.error); return }
    onDone()
  }

  return (
    <form onSubmit={submit} className="mt-3 bg-background rounded-xl border border-border p-4 flex flex-col gap-3">
      <h3 className="text-sm font-bold text-dark-text">Ship to {studentName}</h3>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelCls} mb-1`}>In this box</legend>
        {unshipped.map(d => (
          <label key={d.id} className="flex items-center gap-2 text-sm text-dark-text">
            <input
              type="checkbox"
              checked={held.has(d.id)}
              onChange={e => setHeld(prev => { const next = new Set(prev); if (e.target.checked) next.add(d.id); else next.delete(d.id); return next })}
            />
            {KIND_LABELS[d.kind]} {deviceLabel(d)} <span className="text-xs text-muted-text">(already theirs; tick only if it&apos;s in this box)</span>
          </label>
        ))}
        {neededKinds.map(kind => (
          <label key={kind} className={labelCls}>
            {KIND_LABELS[kind]}
            <select className={`${inputCls} mt-1`} value={picked[kind] ?? ''} onChange={e => setPicked(p => ({ ...p, [kind]: e.target.value }))}>
              <option value="">{available(kind, '').length ? `Choose an in-stock ${KIND_LABELS[kind].toLowerCase()}…` : `No ${KIND_LABELS[kind].toLowerCase()}s in stock`}</option>
              {available(kind, picked[kind] ?? '').map(d => <option key={d.id} value={d.id}>{deviceLabel(d)}</option>)}
            </select>
          </label>
        ))}
        <label className={labelCls}>
          Anything else (optional)
          <select className={`${inputCls} mt-1`} value={extra} onChange={e => setExtra(e.target.value)}>
            <option value="">Nothing else</option>
            {DEVICE_KINDS.map(k => {
              const list = available(k, extra)
              return list.length === 0 ? null : (
                <optgroup key={k} label={`${KIND_LABELS[k]}s`}>
                  {list.map(d => <option key={d.id} value={d.id}>{deviceLabel(d)}</option>)}
                </optgroup>
              )
            })}
          </select>
        </label>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className={labelCls}>
          Carrier
          <select className={`${inputCls} mt-1`} value={carrier} onChange={e => setCarrier(e.target.value as Carrier)}>
            {CARRIERS.map(c => <option key={c} value={c}>{CARRIER_LABELS[c]}</option>)}
          </select>
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Tracking number
          <input className={`${inputCls} mt-1 font-mono`} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="From Pirate Ship" required />
        </label>
        <label className={labelCls}>
          Shipped on
          <input type="date" className={`${inputCls} mt-1`} value={shippedOn} onChange={e => setShippedOn(e.target.value)} required />
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Note (optional)
          <input className={`${inputCls} mt-1`} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. charger included" />
        </label>
      </div>

      <p className="text-xs text-muted-text">The student gets a bell, a Slack DM and an email with the tracking number.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || (chosen.length === 0 && held.size === 0) || !tracking.trim()} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Saving…' : 'Mark shipped'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
          Cancel
        </button>
      </div>
    </form>
  )
}

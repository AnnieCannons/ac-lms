'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { receiveHardwareDevices } from '@/lib/hardware-actions'
import { KIND_LABELS, primaryIdentifier, RECEIVE_STATUSES, STATUS_LABELS, type HardwareDevice, type ReceiveStatus } from '@/lib/hardware'
import { inputCls, labelCls } from './DeviceForm'

const secondaryBtn = 'text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20'

/**
 * "It arrived": pick which of the student's devices came back, note their condition and
 * choose what happens next. Everything is ticked by default, since a returning student
 * usually sends it all at once. After saving, the form is replaced by a confirmation with
 * links to what you'd do next.
 */
export default function ReceiveForm({
  devices,
  onDone,
  onCancel,
  receiveAnotherHref,
  emptyText,
  onSuccess,
  bare = false,
}: {
  devices: HardwareDevice[]
  /** Called when the confirmation is dismissed with "Done". */
  onDone?: () => void
  onCancel?: () => void
  /** Shows a "Mark something else received" link on the confirmation. */
  receiveAnotherHref?: string
  /** Shown instead of the form when nothing is with the student. */
  emptyText?: string
  /** If given, called after saving instead of showing the confirmation here. */
  onSuccess?: (deviceIds: string[], status: ReceiveStatus) => void
  /** Drop the form's own card styling and title when it sits inside another card. */
  bare?: boolean
}) {
  const router = useRouter()
  // Track what's *unticked* so devices that appear after a refresh start ticked.
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const [nextStatus, setNextStatus] = useState<ReceiveStatus>('needs_prep')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [received, setReceived] = useState<{ devices: HardwareDevice[]; status: ReceiveStatus } | null>(null)

  const selected = devices.filter(d => !unticked.has(d.id))
  const toggle = (id: string) => setUnticked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await receiveHardwareDevices(selected.map(d => d.id), nextStatus, notes)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (onSuccess) { onSuccess(selected.map(d => d.id), nextStatus); return }
    setReceived({ devices: selected, status: nextStatus })
    setNotes('')
    setUnticked(new Set())
    router.refresh()
  }

  if (received) {
    const remaining = devices.filter(d => !received.devices.some(r => r.id === d.id))
    return (
      <div role="status" className="bg-surface rounded-2xl border border-teal-primary p-5 flex flex-col gap-3">
        <p className="text-base font-bold text-dark-text">
          <span aria-hidden="true">✓ </span>
          Received {received.devices.map(d => d.asset_tag).join(', ')}
        </p>
        <p className="text-sm text-muted-text">
          {received.devices.length === 1 ? 'It is' : 'They are'} now <strong className="text-dark-text">{STATUS_LABELS[received.status]}</strong>
          {received.status === 'needs_prep' ? ', listed under Needs attention until it is wiped and checked.' : '.'}
          {remaining.length > 0 && ` Still with the student: ${remaining.map(d => d.asset_tag).join(', ')}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {received.devices.map(d => (
            <Link key={d.id} href={`/instructor/hardware/devices/${d.id}`} className={secondaryBtn}>View {d.asset_tag}</Link>
          ))}
          {receiveAnotherHref && <Link href={receiveAnotherHref} className={secondaryBtn}>Mark something else received</Link>}
          {remaining.length > 0 && (
            <button type="button" onClick={() => setReceived(null)} className={secondaryBtn}>Receive more from this student</button>
          )}
          {onDone && <button type="button" onClick={() => { setReceived(null); onDone() }} className={secondaryBtn}>Done</button>}
        </div>
      </div>
    )
  }

  if (devices.length === 0) return emptyText ? <p className="text-sm text-muted-text">{emptyText}</p> : null

  return (
    <form onSubmit={onSubmit} className={bare ? 'flex flex-col gap-4' : 'bg-surface rounded-2xl border border-border p-5 flex flex-col gap-4'}>
      {!bare && <h2 className="text-base font-bold text-dark-text">Mark received</h2>}
      <fieldset>
        <legend className={labelCls}>What came back</legend>
        <ul className="mt-2 flex flex-col gap-2">
          {devices.map(d => (
            <li key={d.id}>
              <label className="flex items-center gap-3 text-sm text-dark-text">
                <input type="checkbox" className="h-4 w-4 accent-teal-primary" checked={!unticked.has(d.id)} onChange={() => toggle(d.id)} />
                <span className="font-semibold">{d.asset_tag}</span>
                <span className="text-muted-text">{KIND_LABELS[d.kind]}</span>
                {primaryIdentifier(d) && <span className="font-mono text-xs text-muted-text break-all">{primaryIdentifier(d)}</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <label className={labelCls}>
        Condition notes
        <textarea className={`${inputCls} mt-1`} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. cracked corner, no charger" />
      </label>
      <fieldset>
        <legend className={labelCls}>What happens next</legend>
        <div className="flex flex-wrap gap-4 mt-2">
          {RECEIVE_STATUSES.map(s => (
            <label key={s} className="flex items-center gap-2 text-sm text-dark-text">
              <input type="radio" name="next-status" checked={nextStatus === s} onChange={() => setNextStatus(s)} />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-text mt-1">Needs prep means wipe and check it before it goes to the next student.</p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || selected.length === 0} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Saving…' : `Mark ${selected.length} received`}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className={secondaryBtn}>Cancel</button>}
      </div>
    </form>
  )
}

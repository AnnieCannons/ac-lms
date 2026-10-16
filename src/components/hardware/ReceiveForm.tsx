'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { receiveHardwareDevices } from '@/lib/hardware-actions'
import { KIND_LABELS, primaryIdentifier, RECEIVE_STATUSES, STATUS_LABELS, type HardwareDevice, type ReceiveStatus } from '@/lib/hardware'
import { inputCls, labelCls } from './DeviceForm'

/**
 * "It arrived": pick which of the student's devices came back, note their condition and
 * choose what happens next. Everything is ticked by default, since a returning student
 * usually sends it all at once.
 */
export default function ReceiveForm({ devices, onDone, onCancel }: { devices: HardwareDevice[]; onDone?: () => void; onCancel?: () => void }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set(devices.map(d => d.id)))
  const [nextStatus, setNextStatus] = useState<ReceiveStatus>('needs_prep')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (devices.length === 0) return null

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await receiveHardwareDevices([...selected], nextStatus, notes)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setDone(`Marked ${res.received} received.`)
    setNotes('')
    onDone?.()
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-4">
      <h2 className="text-base font-bold text-dark-text">Mark received</h2>
      <fieldset>
        <legend className={labelCls}>What came back</legend>
        <ul className="mt-2 flex flex-col gap-2">
          {devices.map(d => (
            <li key={d.id}>
              <label className="flex items-center gap-3 text-sm text-dark-text">
                <input type="checkbox" className="h-4 w-4 accent-teal-primary" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
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
      {done && <p role="status" className="text-sm text-muted-text">{done}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || selected.size === 0} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Saving…' : `Mark ${selected.size} received`}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addHardwareNote, setHardwareDeviceStatus } from '@/lib/hardware-actions'
import { STATUS_LABELS, type DeviceStatus } from '@/lib/hardware'
import { inputCls, labelCls } from './DeviceForm'

const MANUAL: DeviceStatus[] = ['in_stock', 'needs_prep', 'needs_repair', 'lost', 'retired']

/** Status change (only for devices not with a student) and adding a note to the history. */
export default function DeviceActions({ deviceId, status, withStudent }: { deviceId: string; status: DeviceStatus; withStudent: boolean }) {
  const router = useRouter()
  const [nextStatus, setNextStatus] = useState<DeviceStatus>(status)
  const [statusNote, setStatusNote] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    after()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {!withStudent && (
        <form
          className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3"
          onSubmit={e => { e.preventDefault(); run(() => setHardwareDeviceStatus(deviceId, nextStatus, statusNote), () => setStatusNote('')) }}
        >
          <h2 className="text-base font-bold text-dark-text">Change status</h2>
          <label className={labelCls}>
            Status
            <select className={`${inputCls} mt-1`} value={nextStatus} onChange={e => setNextStatus(e.target.value as DeviceStatus)}>
              {!MANUAL.includes(status) && <option value={status}>{STATUS_LABELS[status]}</option>}
              {MANUAL.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            Why (optional)
            <input className={`${inputCls} mt-1`} value={statusNote} onChange={e => setStatusNote(e.target.value)} />
          </label>
          <div>
            <button type="submit" disabled={busy || nextStatus === status} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
              Save status
            </button>
          </div>
        </form>
      )}
      <form
        className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3"
        onSubmit={e => { e.preventDefault(); run(() => addHardwareNote(deviceId, note), () => setNote('')) }}
      >
        <label className={labelCls}>
          Add a note to the history
          <textarea className={`${inputCls} mt-1`} rows={3} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <div>
          <button type="submit" disabled={busy || !note.trim()} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
            Add note
          </button>
        </div>
      </form>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

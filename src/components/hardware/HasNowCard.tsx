'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loanHardwareDevice, markHardwareAwaitingReturn } from '@/lib/hardware-actions'
import { DEVICE_KINDS, KIND_LABELS, type HardwareDevice } from '@/lib/hardware'
import { inputCls, labelCls } from './DeviceForm'
import Card from './Card'
import ReceiveForm from './ReceiveForm'

/**
 * The student's current equipment, with "Loan a device", "Mark all awaiting return" and
 * "Mark received" in the card header. Each form only opens when asked for.
 */
export default function HasNowCard({
  studentId,
  loaned,
  inStock,
  name,
  canManage = true,
  children,
}: {
  /** TAs (day-to-day access) can loan and receive, but not ask for everything back. */
  canManage?: boolean
  studentId: string
  /** In-stock devices that can be loaned to this student. */
  inStock: HardwareDevice[]
  /** Devices with the student that aren't theirs (can come back). */
  loaned: HardwareDevice[]
  name: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [receiving, setReceiving] = useState(false)
  const [loaning, setLoaning] = useState(false)
  const [loanDeviceId, setLoanDeviceId] = useState('')
  const [loanNote, setLoanNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onLoan = loaned.filter(d => d.status === 'on_loan')

  async function markAll() {
    if (!window.confirm(`Mark everything ${name} has on loan as awaiting return?`)) return
    setBusy(true)
    setError(null)
    const res = await markHardwareAwaitingReturn(onLoan.map(d => d.id), '')
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  async function loan(e: React.FormEvent) {
    e.preventDefault()
    if (!loanDeviceId) return
    setBusy(true)
    setError(null)
    const res = await loanHardwareDevice(loanDeviceId, studentId, loanNote)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setLoaning(false)
    setLoanDeviceId('')
    setLoanNote('')
    router.refresh()
  }

  const action = (
    <div className="flex flex-wrap gap-4">
      {!loaning && (
        <button type="button" onClick={() => { setLoaning(true); setReceiving(false) }} className="text-sm font-semibold text-teal-primary hover:underline">
          Loan a device
        </button>
      )}
      {canManage && onLoan.length > 0 && (
        <button type="button" onClick={markAll} disabled={busy} className="text-sm font-semibold text-teal-primary hover:underline disabled:opacity-60">
          {busy ? 'Saving…' : onLoan.length === 1 ? 'Mark awaiting return' : 'Mark all awaiting return'}
        </button>
      )}
      {loaned.length > 0 && !receiving && (
        <button type="button" onClick={() => { setReceiving(true); setLoaning(false) }} className="text-sm font-semibold text-teal-primary hover:underline">
          Mark received
        </button>
      )}
    </div>
  )

  return (
    <Card title="Has now" action={action}>
      {children}
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      {loaning && (
        <form onSubmit={loan} className="mt-4 bg-background rounded-xl border border-border p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-dark-text">Loan a device to {name}</h3>
          {inStock.length === 0 ? (
            <p className="text-sm text-muted-text">Nothing is in stock right now.</p>
          ) : (
            <label className={labelCls}>
              Device
              <select className={`${inputCls} mt-1`} value={loanDeviceId} onChange={e => setLoanDeviceId(e.target.value)} autoFocus>
                <option value="">Choose an in-stock device…</option>
                {DEVICE_KINDS.map(k => {
                  const list = inStock.filter(d => d.kind === k)
                  return list.length === 0 ? null : (
                    <optgroup key={k} label={`${KIND_LABELS[k]}s`}>
                      {list.map(d => (
                        <option key={d.id} value={d.id}>{[d.asset_tag, d.make_model, d.model_year].filter(Boolean).join(' · ')}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </label>
          )}
          <label className={labelCls}>
            Note (optional)
            <input className={`${inputCls} mt-1`} value={loanNote} onChange={e => setLoanNote(e.target.value)} placeholder="e.g. tracking number" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !loanDeviceId} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
              {busy ? 'Saving…' : 'Loan'}
            </button>
            <button type="button" onClick={() => { setLoaning(false); setError(null) }} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
              Cancel
            </button>
          </div>
        </form>
      )}
      {receiving && (
        <div className="mt-4">
          <ReceiveForm devices={loaned} onDone={() => setReceiving(false)} onCancel={() => setReceiving(false)} />
        </div>
      )}
    </Card>
  )
}

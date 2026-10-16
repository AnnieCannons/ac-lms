'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateHardwareTicket } from '@/lib/hardware-actions'
import { KIND_LABELS, type HardwareDevice } from '@/lib/hardware'
import { TICKET_STATUSES, TICKET_STATUS_LABELS, type TicketStatus } from '@/lib/hardware-tickets'
import type { Person } from '@/lib/hardware-server'
import StudentPicker from './StudentPicker'
import { inputCls, labelCls } from './DeviceForm'

const primaryBtn = 'bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60'

function useRun() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    after?.()
    router.refresh()
  }
  return { busy, error, run }
}

/** Status plus a note for the history. */
export function TicketStatusForm({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const { busy, error, run } = useRun()
  const [next, setNext] = useState<TicketStatus>(status)
  const [note, setNote] = useState('')
  return (
    <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); run(() => updateHardwareTicket(ticketId, { status: next, note }), () => setNote('')) }}>
      <label className={labelCls}>
        Status
        <select className={`${inputCls} mt-1 max-w-xs`} value={next} onChange={e => setNext(e.target.value as TicketStatus)}>
          {TICKET_STATUSES.map(s => <option key={s} value={s}>{TICKET_STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <label className={labelCls}>
        Note (optional)
        <input className={`${inputCls} mt-1`} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. sent a new charger, tracking 1Z…" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div><button type="submit" disabled={busy || (next === status && !note.trim())} className={primaryBtn}>{busy ? 'Saving…' : 'Save'}</button></div>
      <p className="text-xs text-muted-text">Sending a replacement? Record it on the student&apos;s hardware page (Replacements) so it counts toward their one each.</p>
    </form>
  )
}

/** Match an unmatched ticket to a student. */
export function TicketStudentMatch({ ticketId }: { ticketId: string }) {
  const { busy, error, run } = useRun()
  const [student, setStudent] = useState<Person | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <StudentPicker label="Which student is this?" value={student} onChange={setStudent} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div><button type="button" disabled={busy || !student} onClick={() => run(() => updateHardwareTicket(ticketId, { studentId: student!.id }))} className={primaryBtn}>Match ticket</button></div>
    </div>
  )
}

/** Pick which of the student's devices the ticket is about. */
export function TicketDevicePick({ ticketId, devices, current }: { ticketId: string; devices: HardwareDevice[]; current: string | null }) {
  const { busy, error, run } = useRun()
  const [deviceId, setDeviceId] = useState(current ?? '')
  if (devices.length === 0) return <p className="text-sm text-muted-text">This student has no equipment recorded.</p>
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={labelCls}>
        Which device?
        <select className={`${inputCls} mt-1`} value={deviceId} onChange={e => setDeviceId(e.target.value)}>
          <option value="">Not sure / none</option>
          {devices.map(d => <option key={d.id} value={d.id}>{[d.asset_tag, KIND_LABELS[d.kind], d.make_model].filter(Boolean).join(' · ')}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy || deviceId === (current ?? '')} onClick={() => run(() => updateHardwareTicket(ticketId, { deviceId: deviceId || null }))} className={primaryBtn}>Save</button>
      {error && <p role="alert" className="text-sm text-red-600 basis-full">{error}</p>}
    </div>
  )
}

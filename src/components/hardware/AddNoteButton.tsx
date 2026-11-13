'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addHardwareNote } from '@/lib/hardware-actions'
import { inputCls } from './DeviceForm'

/** "Add note" in the History card header; opens a small box above the timeline. */
export default function AddNoteButton({ deviceId }: { deviceId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await addHardwareNote(deviceId, note)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setNote('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-teal-primary hover:underline">
        Add note
      </button>
    )
  }

  return (
    <form onSubmit={save} className="basis-full flex flex-col gap-2 mt-3">
      <label className="sr-only" htmlFor={`note-${deviceId}`}>Note for the history</label>
      <textarea id={`note-${deviceId}`} className={inputCls} rows={3} value={note} onChange={e => setNote(e.target.value)} autoFocus placeholder="Note for the history" />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !note.trim()} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Saving…' : 'Add note'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setNote(''); setError(null) }} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
          Cancel
        </button>
      </div>
    </form>
  )
}

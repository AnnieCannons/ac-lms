'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addToHardwareWaitlist, removeFromHardwareWaitlist } from '@/lib/hardware-actions'
import { daysSince, DEVICE_KINDS, KIND_LABELS, type DeviceKind } from '@/lib/hardware'
import type { Person, WaitlistEntry } from '@/lib/hardware-server'
import StudentPicker from './StudentPicker'
import Card from './Card'
import { inputCls, labelCls } from './DeviceForm'

/** Staff-only waitlist: add a student who needs a device, see who's next per type. */
export default function WaitlistManager({ entries }: { entries: WaitlistEntry[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [student, setStudent] = useState<Person | null>(null)
  const [kind, setKind] = useState<DeviceKind>('hotspot')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!student) return
    setBusy(true)
    setError(null)
    const res = await addToHardwareWaitlist(student.id, kind, note)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setStudent(null)
    setNote('')
    setAdding(false)
    router.refresh()
  }

  async function remove(entry: WaitlistEntry) {
    if (!window.confirm(`Take ${entry.student.name ?? entry.student.email} off the ${KIND_LABELS[entry.kind].toLowerCase()} waitlist?`)) return
    const res = await removeFromHardwareWaitlist(entry.id)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-text">
        When you loan a device to someone on the list, they come off it automatically. In-stock devices suggest the people waiting.
      </p>
      {adding ? (
        <form onSubmit={add} className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3 max-w-xl">
          <StudentPicker value={student} onChange={setStudent} />
          <fieldset>
            <legend className={labelCls}>Needs a</legend>
            <div className="flex flex-wrap gap-4 mt-2">
              {DEVICE_KINDS.map(k => (
                <label key={k} className="flex items-center gap-2 text-sm text-dark-text">
                  <input type="radio" name="waitlist-kind" checked={kind === k} onChange={() => setKind(k)} />
                  {KIND_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={labelCls}>
            Note (optional)
            <input className={`${inputCls} mt-1`} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. no wifi at home" />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !student} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
              {busy ? 'Adding…' : 'Add to waitlist'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(null) }} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
            + Add someone
          </button>
        </div>
      )}
      {!adding && error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {DEVICE_KINDS.map(k => {
        const list = entries.filter(e => e.kind === k)
        return (
          <Card key={k} title={`${KIND_LABELS[k]} · ${list.length} waiting`}>
            {list.length === 0 ? <p className="text-sm text-muted-text">No one waiting.</p> : (
              <ol className="flex flex-col divide-y divide-border">
                {list.map((e, i) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0 text-sm">
                    <span className="text-muted-text w-5">{i + 1}.</span>
                    <Link href={`/instructor/hardware/students/${e.student.id}`} className="font-medium text-dark-text hover:text-teal-primary">
                      {e.student.name ?? e.student.email}
                    </Link>
                    <span className="text-xs text-muted-text">waiting {daysSince(e.added_at)} days{e.note ? ` · ${e.note}` : ''}</span>
                    <button type="button" onClick={() => remove(e)} className="ml-auto text-xs font-semibold text-muted-text hover:text-red-600">
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )
      })}
    </div>
  )
}

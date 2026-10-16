'use client'

import { useState } from 'react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import { markHardwareAwaitingReturn, type DropPrompt } from '@/lib/hardware-actions'
import { KIND_LABELS } from '@/lib/hardware'

/**
 * Shown on the Users page right after a student is removed from a course or changed to
 * observer, when they still have equipment on loan. One click asks for it back (they get
 * reminders); the link opens their hardware page in case something needs a closer look.
 */
export default function HardwareDropPrompt({
  prompt,
  reason,
  onClose,
}: {
  prompt: DropPrompt
  /** Goes into the history, e.g. "Removed from Tech Career Foundations (Sept 2026)". */
  reason: string
  onClose: () => void
}) {
  const name = prompt.student.name ?? prompt.student.email
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const selected = prompt.items.filter(i => !unticked.has(i.id))
  const toggle = (id: string) => setUnticked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function markAwaiting() {
    setBusy(true)
    setError(null)
    const res = await markHardwareAwaitingReturn(selected.map(i => i.id), reason)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setDone(res.marked)
  }

  const hardwareLink = (
    <Link href={`/instructor/hardware/students/${prompt.student.id}`} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
      Open their hardware page
    </Link>
  )

  return (
    <Modal title={done != null ? 'Return requested' : `${name} has equipment on loan`} onClose={onClose} maxWidth="max-w-md">
      {done != null ? (
        <div role="status" className="flex flex-col gap-4">
          <p className="text-sm text-dark-text">
            <span aria-hidden="true">✓ </span>
            {done === 1 ? 'It is' : `All ${done} are`} now <strong>awaiting return</strong>. {name} will be reminded to send {done === 1 ? 'it' : 'them'} back,
            and {done === 1 ? 'it shows' : 'they show'} under Hardware → Needs attention until {done === 1 ? 'it arrives' : 'they arrive'}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90">Done</button>
            {hardwareLink}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-text">Do you need it back? Ticked items are marked awaiting return and {name} gets reminders until they arrive.</p>
          <ul className="flex flex-col gap-2">
            {prompt.items.map(i => (
              <li key={i.id}>
                <label className="flex items-center gap-3 text-sm text-dark-text">
                  <input type="checkbox" className="h-4 w-4 accent-teal-primary" checked={!unticked.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="font-semibold">{i.asset_tag}</span>
                  <span className="text-muted-text">{KIND_LABELS[i.kind]}{i.make_model ? ` · ${i.make_model}` : ''}</span>
                </label>
              </li>
            ))}
          </ul>
          {prompt.otherCourses.length > 0 && (
            <p className="text-sm badge-amber border rounded-lg px-3 py-2">
              {name} is still a student in {prompt.otherCourses.join(', ')}. If they&apos;re continuing, they probably still need it.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAwaiting}
              disabled={busy || selected.length === 0}
              className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Mark awaiting return'}
            </button>
            {hardwareLink}
            <button type="button" onClick={onClose} className="text-sm font-semibold px-4 py-2 text-muted-text hover:text-dark-text">
              Not now
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

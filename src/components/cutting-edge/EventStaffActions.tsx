'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteCuttingEdgeEvent, setCuttingEdgeEventPublished } from '@/lib/cutting-edge-actions'
import Modal from '@/components/ui/Modal'
import { withFrom } from '@/lib/cutting-edge'

export default function EventStaffActions({
  eventId,
  published,
  firstPublished,
  audienceCount,
  from,
}: {
  eventId: string
  published: boolean
  firstPublished: boolean
  audienceCount: number
  from?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [notify, setNotify] = useState(true)

  async function setPublished(next: boolean, sendNotifications: boolean) {
    setBusy(true); setError(null)
    const res = await setCuttingEdgeEventPublished(eventId, next, sendNotifications)
    setBusy(false)
    setConfirming(false)
    if (!res.ok) setError(res.error)
    router.refresh()
  }

  function togglePublish() {
    if (published) return setPublished(false, false)
    setNotify(true)
    setConfirming(true)
  }

  async function remove() {
    if (!confirm('Delete this talk? Students will no longer see it and no more reminders will be sent.')) return
    setBusy(true); setError(null)
    const res = await deleteCuttingEdgeEvent(eventId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.push(withFrom('/instructor/cutting-edge-talks', from))
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={togglePublish}
        disabled={busy}
        className={published
          ? 'px-4 py-1.5 rounded-full border border-border text-sm font-semibold text-muted-text hover:text-dark-text disabled:opacity-50'
          : 'bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50'}
      >
        {published ? 'Unpublish' : 'Publish'}
      </button>
      <Link href={withFrom(`/instructor/cutting-edge-talks/${eventId}/edit`, from)} className="px-4 py-1.5 rounded-full border border-border text-sm font-semibold text-dark-text hover:border-teal-primary">
        Edit
      </Link>
      <button type="button" onClick={remove} disabled={busy} className="px-4 py-1.5 rounded-full text-sm font-semibold text-red-600 hover:bg-red-600/10 disabled:opacity-50">
        Delete
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      {confirming && (
        <Modal title="Publish this talk?" onClose={() => setConfirming(false)} maxWidth="max-w-md">
          <p className="text-sm text-muted-text">Students in its audience will be able to see it and RSVP.</p>
          {firstPublished ? (
            <p className="text-sm text-muted-text mt-3">The RSVP notification already went out (or was skipped) the first time — republishing won&apos;t send it again.</p>
          ) : (
            <label className="flex items-start gap-2 mt-4 text-sm text-dark-text">
              <input type="checkbox" className="mt-0.5" checked={notify} onChange={e => setNotify(e.target.checked)} />
              <span>
                Notify {audienceCount} student{audienceCount === 1 ? '' : 's'} now (bell + Slack) asking them to RSVP
                <span className="block text-xs text-muted-text mt-0.5">Uncheck to publish quietly — for testing, or a talk students already know about. This can&apos;t be sent later.</span>
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={() => setConfirming(false)} className="px-4 py-1.5 rounded-full text-sm font-semibold text-muted-text hover:text-dark-text">Cancel</button>
            <button type="button" disabled={busy} onClick={() => setPublished(true, !firstPublished && notify)}
              className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50">
              {busy ? 'Publishing…' : !firstPublished && notify ? 'Publish & notify' : 'Publish'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  pushAssignmentToWeeks, updateUpcomingWeeks, leaveSeries,
  type SeriesInfo,
} from '@/lib/assignment-series-actions'
import { formatDueDate } from '@/lib/date-utils'
import { dayOffset } from '@/lib/assignment-series'

interface Props {
  courseId: string
  assignmentId: string
  info: SeriesInfo
  /** True right after the instructor saved an edit, to offer pushing it to the other weeks. */
  justSaved: boolean
  onDismissSaved: () => void
}

const CARD = 'bg-surface rounded-2xl border border-border p-6'
const LABEL = 'text-xs font-bold text-muted-text uppercase tracking-wide'
const BTN = 'text-sm font-semibold px-4 py-1.5 rounded-full border border-teal-primary text-teal-primary hover:bg-teal-primary hover:[color:var(--color-background)] transition-colors disabled:opacity-50'

export default function AssignmentSeriesPanel({ courseId, assignmentId, info, justSaved, onDismissSaved }: Props) {
  const router = useRouter()
  const copies = info.weeks.filter(w => w.assignmentId)
  const repeats = info.seriesId !== null && copies.length > 1
  const openWeeks = info.weeks.filter(w => !w.assignmentId)
  // info.weeks is in course order, so the weeks after this one are the "following" weeks.
  const currentIndex = copies.findIndex(w => w.isCurrent)
  const following = copies.slice(currentIndex + 1)
  const upcoming = following.filter(w => !w.hasWork)

  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<{ error?: string } & Record<string, unknown>>, ok: (r: Record<string, unknown>) => string) {
    setBusy(key); setError(null); setMessage(null)
    const result = await fn()
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setMessage(ok(result))
    router.refresh()
  }

  const addWeeks = () => run('add', () => pushAssignmentToWeeks({ assignmentId, courseId, moduleIds: selected, dayName: dayOffset(info.dayName) != null ? info.dayName : undefined }), r => {
    setAdding(false); setSelected([])
    const moved = (r.moved ?? []) as { week: string; from: string; to: string; holiday: string }[]
    const skipped = (r.skipped ?? []) as { week: string; holiday: string }[]
    return [
      `Added to ${r.created} week${r.created === 1 ? '' : 's'}.`,
      ...moved.map(m => `${m.week}: ${m.holiday} is on ${m.from}, so it went on ${m.to}.`),
      ...skipped.map(k => `${k.week}: skipped (${k.holiday}).`),
    ].join(' ')
  })

  const pushChanges = () => run('push', () => updateUpcomingWeeks({ assignmentId, courseId }), r => {
    onDismissSaved()
    const skipped = Number(r.skipped ?? 0)
    return `Updated this week and the ${r.updated} following week${r.updated === 1 ? '' : 's'}.` +
      (skipped ? ` ${skipped} week${skipped === 1 ? '' : 's'} with turned-in work ${skipped === 1 ? 'was' : 'were'} left as is.` : '')
  })

  const detach = () => {
    if (!confirm('Stop this week repeating with the others? It stays as a regular assignment.')) return
    run('leave', () => leaveSeries({ assignmentId, courseId }), () => 'This week no longer repeats with the others.')
  }

  return (
    <div className="flex flex-col gap-6">
      {repeats && justSaved && upcoming.length > 0 && (
        <div role="group" aria-label="Apply your changes to" className="rounded-2xl border border-teal-primary bg-teal-light p-4 flex flex-col gap-3">
          <p className="text-sm text-dark-text font-semibold">Saved. Apply these changes to:</p>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={onDismissSaved} disabled={busy !== null} className={BTN}>
              This week only
            </button>
            <button type="button" onClick={pushChanges} disabled={busy !== null} className={BTN}>
              {busy === 'push' ? 'Updating…' : `This week and following weeks (${upcoming.length} more)`}
            </button>
          </div>
          {following.length > upcoming.length && (
            <p className="text-xs text-muted-text">Following weeks where someone already turned something in are left as they are.</p>
          )}
        </div>
      )}

      {/* Repeats weekly */}
      <div className={CARD}>
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <p className={LABEL}>{repeats ? `Repeats weekly (${copies.length} weeks)` : 'One-time assignment'}</p>
          {repeats && upcoming.length > 0 && !justSaved && (
            <button type="button" onClick={pushChanges} disabled={busy !== null} className="text-xs text-teal-primary hover:underline disabled:opacity-50">
              {busy === 'push' ? 'Updating…' : 'Copy this week’s content to the following weeks'}
            </button>
          )}
        </div>

        {repeats ? (
          <ul className="flex flex-col gap-1.5 mb-3">
            {copies.map(w => (
              <li key={w.moduleId} className="flex items-center gap-3 text-sm">
                {w.isCurrent ? (
                  <span className="font-semibold text-dark-text flex-1">{w.title} <span className="text-xs font-normal text-muted-text">(this one)</span></span>
                ) : (
                  <Link href={`/instructor/courses/${courseId}/assignments/${w.assignmentId}`} className="text-teal-primary hover:underline flex-1">{w.title}</Link>
                )}
                <span className="text-xs text-muted-text">{w.dueDate ? `Due ${formatDueDate(w.dueDate)}` : 'No due date'}</span>
                <span className="text-xs text-muted-text w-16 text-right">{w.published ? 'Published' : 'Draft'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-text mb-3">
            Add this assignment to other weeks to make it repeat. Each week keeps its own due date and grades.
          </p>
        )}

        {openWeeks.length > 0 && (adding ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs text-muted-text">
              Copies go on {info.dayName ? <strong>{info.dayName}</strong> : 'the same day'} of each week (the day before, if it’s a holiday), due the day after.
            </p>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-teal-primary hover:underline" onClick={() => setSelected(openWeeks.map(w => w.moduleId))}>All</button>
              {selected.length > 0 && <button type="button" className="text-muted-text hover:underline" onClick={() => setSelected([])}>Clear</button>}
            </div>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
              {openWeeks.map(w => (
                <label key={w.moduleId} className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-teal-primary"
                    checked={selected.includes(w.moduleId)}
                    onChange={() => setSelected(prev => prev.includes(w.moduleId) ? prev.filter(x => x !== w.moduleId) : [...prev, w.moduleId])}
                  />
                  {w.title}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={addWeeks} disabled={busy !== null || selected.length === 0} className={BTN}>
                {busy === 'add' ? 'Adding…' : `Add to ${selected.length || ''} week${selected.length === 1 ? '' : 's'}`}
              </button>
              <button type="button" onClick={() => { setAdding(false); setSelected([]) }} className="text-sm text-muted-text hover:text-dark-text px-2">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setAdding(true)} className="text-sm text-teal-primary hover:underline">
              {repeats ? '+ Add to more weeks' : 'Make this repeat…'}
            </button>
            {repeats && (
              <button type="button" onClick={detach} disabled={busy !== null} className="text-xs text-muted-text hover:text-dark-text hover:underline">
                Stop this week repeating
              </button>
            )}
          </div>
        ))}
      </div>

      {(message || error) && (
        <p role={error ? 'alert' : 'status'} className={`text-sm ${error ? 'text-red-400' : 'text-teal-primary'}`}>{error ?? message}</p>
      )}
    </div>
  )
}

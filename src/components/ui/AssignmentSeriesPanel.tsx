'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  pushAssignmentToWeeks, updateUpcomingWeeks, setGoalCheckoff, leaveSeries,
  type SeriesInfo,
} from '@/lib/assignment-series-actions'
import { formatDueDate } from '@/lib/date-utils'

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
  const others = copies.filter(w => !w.isCurrent)
  const upcoming = others.filter(w => !w.hasWork)

  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [goalOn, setGoalOn] = useState(!!info.goalLabel)
  const [goalLabel, setGoalLabel] = useState(info.goalLabel ?? 'I met my goal this week')
  const [goalWholeSeries, setGoalWholeSeries] = useState(true)

  async function run(key: string, fn: () => Promise<{ error?: string } & Record<string, unknown>>, ok: (r: Record<string, unknown>) => string) {
    setBusy(key); setError(null); setMessage(null)
    const result = await fn()
    setBusy(null)
    if (result.error) { setError(result.error); return }
    setMessage(ok(result))
    router.refresh()
  }

  const addWeeks = () => run('add', () => pushAssignmentToWeeks({ assignmentId, courseId, moduleIds: selected }), r => {
    setAdding(false); setSelected([])
    return `Added to ${r.created} week${r.created === 1 ? '' : 's'}.`
  })

  const pushChanges = () => run('push', () => updateUpcomingWeeks({ assignmentId, courseId }), r => {
    onDismissSaved()
    const skipped = Number(r.skipped ?? 0)
    return `Updated ${r.updated} week${r.updated === 1 ? '' : 's'}.` +
      (skipped ? ` ${skipped} week${skipped === 1 ? '' : 's'} with turned-in work ${skipped === 1 ? 'was' : 'were'} left as is.` : '')
  })

  const saveGoal = () => run('goal', () => setGoalCheckoff({
    assignmentId, courseId, label: goalOn ? goalLabel : null, wholeSeries: repeats && goalWholeSeries,
  }), () => goalOn ? 'Goal checkbox saved.' : 'Goal checkbox turned off.')

  const detach = () => {
    if (!confirm('Stop this week repeating with the others? It stays as a regular assignment.')) return
    run('leave', () => leaveSeries({ assignmentId, courseId }), () => 'This week no longer repeats with the others.')
  }

  return (
    <div className="flex flex-col gap-6">
      {repeats && justSaved && upcoming.length > 0 && (
        <div role="status" className="rounded-2xl border border-teal-primary bg-teal-light p-4 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-dark-text">
            Saved. Update the {upcoming.length} other week{upcoming.length === 1 ? '' : 's'} with these changes too?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={pushChanges} disabled={busy !== null} className={BTN}>
              {busy === 'push' ? 'Updating…' : `Update ${upcoming.length} week${upcoming.length === 1 ? '' : 's'}`}
            </button>
            <button type="button" onClick={onDismissSaved} className="text-sm text-muted-text hover:text-dark-text px-2">Not now</button>
          </div>
        </div>
      )}

      {/* Repeats weekly */}
      <div className={CARD}>
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <p className={LABEL}>{repeats ? `Repeats weekly (${copies.length} weeks)` : 'One-time assignment'}</p>
          {repeats && upcoming.length > 0 && !justSaved && (
            <button type="button" onClick={pushChanges} disabled={busy !== null} className="text-xs text-teal-primary hover:underline disabled:opacity-50">
              {busy === 'push' ? 'Updating…' : 'Copy this week’s content to the other weeks'}
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
              Copies go on {info.dayName ? <strong>{info.dayName}</strong> : 'the same day'} of each week, with the due date moved to match.
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

      {/* Goal check-off */}
      <div className={CARD}>
        <p className={`${LABEL} mb-3`}>“I met my goal” checkbox</p>
        <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer">
          <input type="checkbox" className="accent-teal-primary" checked={goalOn} onChange={e => setGoalOn(e.target.checked)} />
          Students can check that they met their goal
        </label>
        {goalOn && (
          <div className="mt-3 flex flex-col gap-2">
            <label className="text-xs text-muted-text" htmlFor="goal-label">What the checkbox says</label>
            <input
              id="goal-label"
              type="text"
              maxLength={200}
              value={goalLabel}
              onChange={e => setGoalLabel(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
            <p className="text-xs text-muted-text">
              Checking it shows confetti and flags the student when you grade.
              {repeats && ' If you confirm it, they’re excused from every later week of this assignment.'}
            </p>
          </div>
        )}
        {repeats && (
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-text cursor-pointer">
            <input type="checkbox" className="accent-teal-primary" checked={goalWholeSeries} onChange={e => setGoalWholeSeries(e.target.checked)} />
            Apply to all {copies.length} weeks
          </label>
        )}
        <div className="mt-3">
          <button type="button" onClick={saveGoal} disabled={busy !== null || (goalOn && !goalLabel.trim())} className={BTN}>
            {busy === 'goal' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {(message || error) && (
        <p role={error ? 'alert' : 'status'} className={`text-sm ${error ? 'text-red-400' : 'text-teal-primary'}`}>{error ?? message}</p>
      )}
    </div>
  )
}

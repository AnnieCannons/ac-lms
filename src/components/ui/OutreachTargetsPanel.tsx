'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import { useToday, formatDate } from '@/components/ui/SalesPipelineBoard'
import type { OutreachTargetInput } from '@/lib/partner-sales-actions'
import {
  COMPANY_SEGMENTS, COMPANY_SEGMENT_LABELS, TARGET_STATUS_LABELS, TARGET_STATUS_COLORS,
  computeTargetProgress, sortTargets, formatDays, todayIso,
  type OutreachTarget, type PipelineDeal, type CompanySegment, type TargetProgress,
} from '@/lib/sales-pipeline'

const BAR_COLORS: Record<CompanySegment, string> = {
  growth_stage: 'bg-teal-primary',
  enterprise: 'bg-indigo-500',
}

export default function OutreachTargetsPanel({ targets, deals, onSave, onDelete }: {
  targets: OutreachTarget[]
  deals: PipelineDeal[]
  onSave: (id: string | null, input: OutreachTargetInput) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
}) {
  const today = useToday()
  const [editing, setEditing] = useState<OutreachTarget | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sorted = useMemo(() => sortTargets(targets, today), [targets, today])

  async function handleDelete(target: OutreachTarget) {
    const label = `${COMPANY_SEGMENT_LABELS[target.segment]} target (${target.targetCount} companies)`
    if (!window.confirm(`Delete the ${label}? The companies themselves aren’t affected.`)) return
    setError(await onDelete(target.id))
  }

  return (
    <section aria-labelledby="targets-heading" className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h2 id="targets-heading" className="text-xs font-semibold text-muted-text uppercase tracking-wide">Outreach targets</h2>
        <button type="button" onClick={() => setEditing('new')} className="text-sm text-teal-primary hover:underline">
          + Add target
        </button>
      </div>
      <p className="text-xs text-muted-text mb-4">
        A company counts when its company size matches and its &ldquo;Entered pipeline&rdquo; date falls within the target&apos;s dates.
        Set the company size from a card&apos;s dialog.
      </p>

      {error && <p role="alert" className="text-sm text-red-700 mb-3">Couldn&apos;t delete the target: {error}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-text">No outreach targets yet.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map(target => (
            <TargetCard
              key={target.id}
              target={target}
              progress={computeTargetProgress(target, deals, today)}
              unsized={countUnsized(target, deals)}
              onEdit={() => setEditing(target)}
              onDelete={() => handleDelete(target)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <TargetModal
          target={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async input => {
            const err = await onSave(editing === 'new' ? null : editing.id, input)
            if (!err) setEditing(null)
            return err
          }}
        />
      )}
    </section>
  )
}

/** Companies that entered the pipeline during the target's dates but have no company size, so can't count yet. */
function countUnsized(target: OutreachTarget, deals: PipelineDeal[]): number {
  return deals.filter(d => !d.companySegment && d.startedOn && d.startedOn >= target.startDate && d.startedOn <= target.endDate).length
}

function TargetCard({ target, progress, unsized, onEdit, onDelete }: {
  target: OutreachTarget
  progress: TargetProgress
  unsized: number
  onEdit: () => void
  onDelete: () => void
}) {
  const label = COMPANY_SEGMENT_LABELS[target.segment]
  const percent = Math.min(100, Math.round((progress.addedCount / target.targetCount) * 100))
  const pacePercent = progress.expectedByNow !== null
    ? Math.min(100, Math.round((progress.expectedByNow / target.targetCount) * 100))
    : null
  const showPace = progress.status === 'on_track' || progress.status === 'behind'

  return (
    <li className="rounded-lg bg-background px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-dark-text">{label} companies</h3>
        {progress.status && (
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${TARGET_STATUS_COLORS[progress.status]}`}>
            {TARGET_STATUS_LABELS[progress.status]}
          </span>
        )}
      </div>

      <p className="text-dark-text">
        <span className="text-2xl font-bold">{progress.addedCount}</span>
        <span className="text-sm text-muted-text"> of {target.targetCount} added</span>
      </p>

      <div
        className="relative h-2.5 rounded-full bg-border overflow-hidden"
        role="progressbar"
        aria-label={`${label} target progress`}
        aria-valuemin={0}
        aria-valuemax={target.targetCount}
        aria-valuenow={Math.min(progress.addedCount, target.targetCount)}
      >
        <div className={`h-full ${BAR_COLORS[target.segment]} transition-all`} style={{ width: `${percent}%` }} />
        {showPace && pacePercent !== null && pacePercent > 0 && pacePercent < 100 && (
          <div className="absolute top-0 h-full w-0.5 bg-dark-text/60" style={{ left: `${pacePercent}%` }} title="Even pace by today" />
        )}
      </div>

      <p className="text-xs text-muted-text">
        {formatDate(target.startDate)} – {formatDate(target.endDate)}
        {progress.daysLeft !== null && progress.daysLeft > 0 && <> · {formatDays(progress.daysLeft)} left</>}
      </p>
      {showPace && (
        <p className="text-xs text-muted-text">
          {progress.remaining} to go · an even pace would be {progress.expectedByNow} by today
        </p>
      )}
      {unsized > 0 && (
        <p className="text-xs text-yellow-800 dark:text-yellow-300">
          {unsized} {unsized === 1 ? 'company' : 'companies'} entered the pipeline in this period with no company size set, so {unsized === 1 ? 'it doesn’t' : 'they don’t'} count yet.
        </p>
      )}

      {progress.added.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-teal-primary hover:underline">Companies counted ({progress.added.length})</summary>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {progress.added.map(d => (
              <li key={d.partnerId} className="flex justify-between gap-2">
                <Link href={`/instructor/partnerships/${d.partnerId}`} className="text-dark-text hover:underline truncate">{d.partnerName}</Link>
                {d.startedOn && <span className="text-muted-text shrink-0">{formatDate(d.startedOn)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex gap-3 text-xs">
        <button type="button" onClick={onEdit} className="text-teal-primary hover:underline">Edit</button>
        <button type="button" onClick={onDelete} className="text-muted-text hover:text-red-700">Delete</button>
      </div>
    </li>
  )
}

/** Six months from `start`, inclusive: the day before the same date six months later. */
function sixMonthsFrom(start: string): string {
  const [y, m, d] = start.split('-').map(Number)
  const end = new Date(Date.UTC(y, m - 1 + 6, d - 1))
  return end.toISOString().slice(0, 10)
}

function TargetModal({ target, onClose, onSave }: {
  target: OutreachTarget | null
  onClose: () => void
  onSave: (input: OutreachTargetInput) => Promise<string | null>
}) {
  const [segment, setSegment] = useState<CompanySegment>(target?.segment ?? 'growth_stage')
  const [count, setCount] = useState(target ? String(target.targetCount) : '')
  const [startDate, setStartDate] = useState(target?.startDate ?? todayIso())
  const [endDate, setEndDate] = useState(target?.endDate ?? sixMonthsFrom(todayIso()))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const targetCount = Number(count)
    if (!Number.isInteger(targetCount) || targetCount < 1) {
      setFormError('Enter a whole number of companies, at least 1.')
      return
    }
    if (!startDate || !endDate) {
      setFormError('Choose a start and end date.')
      return
    }
    if (endDate < startDate) {
      setFormError('The end date can’t be before the start date.')
      return
    }
    setFormError(null)
    setSaving(true)
    const error = await onSave({ segment, targetCount, startDate, endDate })
    setSaving(false)
    if (error) setFormError(`Couldn't save: ${error}`)
  }

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary'
  const labelClass = 'flex flex-col gap-1 text-sm font-medium text-dark-text'

  return (
    <Modal title={target ? 'Edit outreach target' : 'New outreach target'} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Company size
          <select value={segment} onChange={e => setSegment(e.target.value as CompanySegment)} className={inputClass}>
            {COMPANY_SEGMENTS.map(s => <option key={s} value={s}>{COMPANY_SEGMENT_LABELS[s]}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Companies to add
          <input
            type="number" min={1} step={1} inputMode="numeric" required
            value={count}
            onChange={e => setCount(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Start date
            <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            End date
            <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
          </label>
        </div>

        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-text hover:text-dark-text">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

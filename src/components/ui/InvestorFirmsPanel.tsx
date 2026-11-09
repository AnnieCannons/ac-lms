'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import { PlacementSummary, formatDate, useToday } from '@/components/ui/SalesPipelineBoard'
import type { SalesDealUpdate, InvestorFirmUpdate } from '@/lib/partner-sales-actions'
import {
  LP_STATUSES, LP_STATUS_LABELS, LP_STATUS_COLORS, FIRM_KIND_LABELS,
  SALES_STAGE_LABELS, SALES_STAGE_COLORS, summarizeFirms, computeCycleStats, daysBetween, formatDays, todayIso,
  type InvestorFirm, type PipelineDeal, type LpStatus,
} from '@/lib/sales-pipeline'

export default function InvestorFirmsPanel({ firms, deals, onSaveFirm, onSaveDeal }: {
  firms: InvestorFirm[]
  deals: PipelineDeal[]
  onSaveFirm: (partnerId: string, update: InvestorFirmUpdate) => Promise<string | null>
  onSaveDeal: (partnerId: string, update: SalesDealUpdate) => Promise<string | null>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const summary = useMemo(() => summarizeFirms(firms, deals), [firms, deals])
  const introToClose = useMemo(() => {
    const firmIds = new Set(firms.map(f => f.partnerId))
    return computeCycleStats(deals.filter(d => d.introducedByPartnerId && firmIds.has(d.introducedByPartnerId))).introToCloseWon
  }, [firms, deals])
  const editingFirm = firms.find(f => f.partnerId === editingId) ?? null

  if (firms.length === 0) {
    return (
      <div className="text-center py-16 text-muted-text">
        <p className="text-lg font-medium mb-2">No VC or PE firms yet</p>
        <p className="text-sm">
          Tag a partner as Venture Capital or Private Equity from its edit page and it will show up here.
        </p>
      </div>
    )
  }

  const stats = [
    { label: 'Firms', value: String(summary.firmCount), detail: null },
    { label: 'Portfolio companies introduced', value: String(summary.introductionCount), detail: null },
    {
      label: 'Introduction to apprentice placed',
      value: formatDays(introToClose.averageDays),
      detail: introToClose.count > 0
        ? `average · median ${formatDays(introToClose.medianDays)} · ${introToClose.count} placed`
        : 'No introduced companies have placed an apprentice yet',
    },
    { label: 'Engaged in LP strategy', value: String(summary.lpCounts.engaged), detail: null },
    { label: 'In LP discussion', value: String(summary.lpCounts.in_discussion + summary.lpCounts.introduced), detail: null },
  ]

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="firms-summary-heading" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="firms-summary-heading" className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">
          VC &amp; PE overview
        </h2>
        <dl className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-lg bg-background px-4 py-3">
              <dt className="text-xs text-muted-text">{s.label}</dt>
              <dd className="text-2xl font-bold text-dark-text">{s.value}</dd>
              {s.detail && <dd className="text-xs text-muted-text mt-0.5">{s.detail}</dd>}
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2" aria-label="Firms by LP strategy status">
          {LP_STATUSES.map(s => (
            <span key={s} className={`text-xs font-medium rounded-full px-3 py-1 ${LP_STATUS_COLORS[s]}`}>
              {LP_STATUS_LABELS[s]}: {summary.lpCounts[s]}
            </span>
          ))}
        </div>
      </section>

      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {firms.map(firm => (
          <li key={firm.partnerId}>
            <FirmCard
              firm={firm}
              deals={deals}
              onEditLp={() => setEditingId(firm.partnerId)}
              onSaveDeal={onSaveDeal}
            />
          </li>
        ))}
      </ul>

      {editingFirm && (
        <EditLpModal
          firm={editingFirm}
          onClose={() => setEditingId(null)}
          onSave={async update => {
            const error = await onSaveFirm(editingFirm.partnerId, update)
            if (!error) setEditingId(null)
            return error
          }}
        />
      )}
    </div>
  )
}

function FirmCard({ firm, deals, onEditLp, onSaveDeal }: {
  firm: InvestorFirm
  deals: PipelineDeal[]
  onEditLp: () => void
  onSaveDeal: (partnerId: string, update: SalesDealUpdate) => Promise<string | null>
}) {
  const [linkId, setLinkId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const introduced = deals.filter(d => d.introducedByPartnerId === firm.partnerId)
  const linkable = deals.filter(d => !d.introducedByPartnerId && d.partnerId !== firm.partnerId)
  const today = useToday()
  const firmIntroToClose = computeCycleStats(introduced).introToCloseWon

  function introTiming(d: PipelineDeal): string {
    if (!d.introducedOn) return 'Introduction date not set'
    const label = `Introduced ${formatDate(d.introducedOn)}`
    if (d.isHistorical) return `${label} · historical`
    if (d.closedOn) return `${label} · closed after ${formatDays(daysBetween(d.introducedOn, d.closedOn))}`
    return today ? `${label} · ${formatDays(daysBetween(d.introducedOn, today))} ago` : label
  }

  async function run(partnerId: string, update: SalesDealUpdate) {
    setBusy(true)
    setError(null)
    const err = await onSaveDeal(partnerId, update)
    setBusy(false)
    if (err) setError(err)
    return err
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    if (!linkId) return
    const err = await run(linkId, { introducedByPartnerId: firm.partnerId, introducedOn: todayIso() })
    if (!err) setLinkId('')
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4 h-full">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-dark-text truncate">
              <Link href={`/instructor/partnerships/${firm.partnerId}`} className="hover:underline">{firm.name}</Link>
            </h3>
            {firm.kinds.map(k => (
              <span key={k} className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                {FIRM_KIND_LABELS[k]}
              </span>
            ))}
          </div>
          {firm.ownerName && <p className="text-xs text-muted-text mt-0.5">Owner: {firm.ownerName}</p>}
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-text uppercase tracking-wide">LP strategy</span>
          <button type="button" onClick={onEditLp} className="text-xs text-teal-primary hover:underline">
            Update<span className="sr-only"> LP strategy for {firm.name}</span>
          </button>
        </div>
        <span className={`self-start text-xs font-medium rounded-full px-2.5 py-0.5 ${LP_STATUS_COLORS[firm.lpStatus]}`}>
          {LP_STATUS_LABELS[firm.lpStatus]}
        </span>
        {firm.lpNotes && <p className="text-sm text-dark-text whitespace-pre-wrap">{firm.lpNotes}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-text uppercase tracking-wide">
          Portfolio companies introduced ({introduced.length})
        </span>
        {firmIntroToClose.count > 0 && (
          <span className="text-xs text-muted-text">
            Average introduction to apprentice placed: {formatDays(firmIntroToClose.averageDays)} ({firmIntroToClose.count} placed)
          </span>
        )}
        {introduced.length === 0 ? (
          <p className="text-sm text-muted-text">None yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {introduced.map(d => (
              <li key={d.partnerId} className="py-2 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/instructor/partnerships/${d.partnerId}`} className="text-sm font-medium text-dark-text hover:underline truncate">
                    {d.partnerName}
                  </Link>
                  <span className={`shrink-0 text-[11px] font-medium rounded-full px-2 py-0.5 ${SALES_STAGE_COLORS[d.stage]}`}>
                    {SALES_STAGE_LABELS[d.stage]}
                  </span>
                </div>
                <PlacementSummary placements={d.placements} />
                <div className="flex items-center justify-between gap-2 text-xs text-muted-text">
                  <span>{introTiming(d)}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(d.partnerId, { introducedByPartnerId: null })}
                    className="hover:text-red-700 disabled:opacity-60"
                  >
                    Unlink<span className="sr-only"> {d.partnerName} from {firm.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleLink} className="flex gap-2 mt-1">
          <label className="sr-only" htmlFor={`link-${firm.partnerId}`}>Add a company introduced by {firm.name}</label>
          <select
            id={`link-${firm.partnerId}`}
            value={linkId}
            onChange={e => setLinkId(e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          >
            <option value="">Add an introduced company…</option>
            {linkable.map(d => <option key={d.partnerId} value={d.partnerId}>{d.partnerName}</option>)}
          </select>
          <button
            type="submit"
            disabled={!linkId || busy}
            className="px-3 py-1.5 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>
        <p className="text-xs text-muted-text">
          Only Apprenticeship partners not already linked to a firm are listed. To add a new company, create it with the Apprenticeship type first.
        </p>
        {error && <p role="alert" className="text-sm text-red-700">Couldn&apos;t save: {error}</p>}
      </div>
    </article>
  )
}

function EditLpModal({ firm, onClose, onSave }: {
  firm: InvestorFirm
  onClose: () => void
  onSave: (update: InvestorFirmUpdate) => Promise<string | null>
}) {
  const [lpStatus, setLpStatus] = useState<LpStatus>(firm.lpStatus)
  const [lpNotes, setLpNotes] = useState(firm.lpNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    const error = await onSave({ lpStatus, lpNotes })
    setSaving(false)
    if (error) setFormError(`Couldn't save: ${error}`)
  }

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary'

  return (
    <Modal title={`${firm.name}: LP strategy`} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-dark-text">
          Status
          <select value={lpStatus} onChange={e => setLpStatus(e.target.value as LpStatus)} className={inputClass}>
            {LP_STATUSES.map(s => <option key={s} value={s}>{LP_STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-dark-text">
          Notes
          <textarea value={lpNotes} onChange={e => setLpNotes(e.target.value)} rows={5} className={inputClass} />
        </label>

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

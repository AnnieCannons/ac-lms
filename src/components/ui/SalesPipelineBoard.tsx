'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import Modal from '@/components/ui/Modal'
import type { SalesDealUpdate } from '@/lib/partner-sales-actions'
import {
  SALES_STAGES, SALES_STAGE_LABELS, SALES_STAGE_COLORS, OPEN_SALES_STAGES,
  summarizePipeline, computeCycleStats, isSalesStage, isClosedStage, daysBetween, formatDays, todayIso,
  PLACEMENT_TERMS, PLACEMENT_TERM_LABELS, formatPlacementTerm, sortPlacements, upcomingPlacementTerm,
  FEE_STATUSES, FEE_STATUS_LABELS, FEE_STATUS_COLORS, formatCurrency, formatPercent,
  REFERRAL_SOURCES, REFERRAL_SOURCE_LABELS, REFERRAL_DETAIL_LABELS, REFERRAL_DETAIL_MAX_LENGTH, describeReferral,
  COMPANY_SEGMENTS, COMPANY_SEGMENT_LABELS,
  type PipelineDeal, type InvestorFirm, type SalesStage, type DurationStats,
  type ApprenticePlacement, type PlacementTerm, type FeeStatus, type ReferralSource, type CompanySegment,
} from '@/lib/sales-pipeline'

const noopSubscribe = () => () => {}

/** The user's local date, or null during server render, where the server's (UTC) date may differ. */
export function useToday(): string | null {
  return useSyncExternalStore(noopSubscribe, () => todayIso(), () => null)
}

const FUNNEL_BAR_COLORS: Record<SalesStage, string> = {
  lead:          'bg-slate-400',
  contacted:     'bg-sky-500',
  meeting_held:  'bg-blue-500',
  proposal_sent: 'bg-yellow-500',
  negotiation:   'bg-orange-500',
  closed_won:    'bg-green-500',
  closed_lost:   'bg-emerald-600',
}

export function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Per-term lines on a card: "Jan 2027 · 3 placed, 2 converted · Placement fee $10,000 (Paid)". */
export function PlacementSummary({ placements }: { placements: ApprenticePlacement[] }) {
  if (placements.length === 0) return null
  return (
    <ul className="flex flex-col gap-0.5">
      {placements.map(p => (
        <li key={`${p.term}-${p.year}`} className="text-xs text-dark-text flex flex-wrap items-center gap-x-1.5">
          <span className="font-semibold">{formatPlacementTerm(p)}</span>
          <span className="text-muted-text">{p.count} placed, {p.convertedCount} converted</span>
          <span className={`text-[11px] font-medium rounded-full px-1.5 ${FEE_STATUS_COLORS[p.feeStatus]}`}>
            Placement fee {p.feeAmount != null ? formatCurrency(p.feeAmount) : 'not set'} ({FEE_STATUS_LABELS[p.feeStatus]})
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function SalesPipelineBoard({ deals, firms, onSaveDeal }: {
  deals: PipelineDeal[]
  firms: InvestorFirm[]
  onSaveDeal: (partnerId: string, update: SalesDealUpdate) => Promise<string | null>
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const today = useToday()
  const summary = useMemo(() => summarizePipeline(deals, today), [deals, today])
  const cycle = useMemo(() => computeCycleStats(deals, today), [deals, today])
  const firmNames = useMemo(() => new Map(firms.map(f => [f.partnerId, f.name])), [firms])
  const activeDeal = deals.find(d => d.partnerId === activeId) ?? null
  const editingDeal = deals.find(d => d.partnerId === editingId) ?? null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const partnerId = String(event.active.id)
    const stage = event.over?.id
    if (!isSalesStage(stage)) return
    const deal = deals.find(d => d.partnerId === partnerId)
    if (!deal || deal.stage === stage) return
    setSaveError(null)
    void onSaveDeal(partnerId, { stage }).then(error => {
      setSaveError(error)
      if (!error && stage === 'closed_won' && deal.placements.length === 0) setEditingId(partnerId)
    })
  }

  if (deals.length === 0) {
    return (
      <div className="text-center py-16 text-muted-text">
        <p className="text-lg font-medium mb-2">No Apprenticeship partners yet</p>
        <p className="text-sm">
          Partners tagged with the Apprenticeship type show up here. Add the type from a partner&apos;s edit page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      

      {saveError && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Couldn&apos;t save that change: {saveError}
        </p>
      )}

      <DndContext id="sales-pipeline-board" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {SALES_STAGES.map(stage => (
            <StageColumn
              key={stage}
              stage={stage}
              deals={deals.filter(d => d.stage === stage)}
              firmNames={firmNames}
              onOpen={setEditingId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? <DealCardBody deal={activeDeal} firmName={firmNames.get(activeDeal.introducedByPartnerId ?? '') ?? null} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {editingDeal && (
        <EditDealModal
          deal={editingDeal}
          firms={firms}
          onClose={() => setEditingId(null)}
          onSave={async update => {
            const error = await onSaveDeal(editingDeal.partnerId, update)
            if (!error) setEditingId(null)
            return error
          }}
        />
      )}
      <PipelineKpis summary={summary} total={deals.length} today={today} />
      <SalesCycleKpis cycle={cycle} showOpenAge={today !== null} />
    </div>
  )
}

/** Compact conversion rate card; counts finished placements only, like the "Apprentices converted" KPI. */
export function ConversionRateCard({ deals }: { deals: PipelineDeal[] }) {
  const today = useToday()
  const summary = useMemo(() => summarizePipeline(deals, today), [deals, today])
  const pending = [
    summary.inPlacement > 0 ? `${summary.inPlacement} still in placement` : null,
    summary.upcoming > 0 ? `${summary.upcoming} starting later` : null,
  ].filter(Boolean)

  let detail: string | null = null
  if (today) {
    detail = summary.finishedPlaced > 0
      ? `${summary.finishedConverted} of ${summary.finishedPlaced} apprentices with finished placements converted`
      : 'No finished placements yet'
  }

  return (
    <section aria-labelledby="conversion-heading" className="rounded-xl border border-border bg-surface px-5 py-4 border-l-4 border-l-purple-300 max-w-sm">
      <h2 id="conversion-heading" className="text-xs font-semibold text-muted-text uppercase tracking-wide">Conversion rate</h2>
      <p className="text-3xl font-bold text-dark-text mt-1">{today ? formatPercent(summary.conversionRate) : '—'}</p>
      {/* {detail && <p className="text-xs text-muted-text mt-0.5">{detail}</p>}
      {today && pending.length > 0 && <p className="text-xs text-muted-text">Not counted yet: {pending.join(' · ')}</p>} */}
    </section>
  )
}

function conversionDetail(summary: ReturnType<typeof summarizePipeline>, today: string | null): string {
  if (!today) return `— conversion rate · ${plural(summary.convertingPartners, 'partner')}`
  const rate = summary.finishedPlaced > 0
    ? `${formatPercent(summary.conversionRate)} conversion rate (${summary.finishedConverted} of ${summary.finishedPlaced} with finished placements)`
    : 'No finished placements yet, so no conversion rate'
  const pending = [
    summary.inPlacement > 0 ? `${summary.inPlacement} still in placement` : null,
    summary.upcoming > 0 ? `${summary.upcoming} starting later` : null,
  ].filter(Boolean)
  return [rate, ...pending, plural(summary.convertingPartners, 'partner')].join(' · ')
}

function PipelineKpis({ summary, total, today }: { summary: ReturnType<typeof summarizePipeline>; total: number; today: string | null }) {
  const maxCount = Math.max(1, ...OPEN_SALES_STAGES.map(s => summary.stageCounts[s]))
  const fees = summary.feesByStatus

  const kpis = [
    {
      label: 'Hiring partners',
      value: String(summary.hiringPartners),
      detail: `with an apprentice placed, of ${plural(total, 'Apprenticeship partner')}`,
      accent: 'border-teal-300',
    },
    {
      label: 'Apprentices placed',
      value: String(summary.placed),
      detail: null,
      accent: 'border-blue-300',
    },
    {
      label: 'Apprentices converted',
      value: String(summary.converted),
      detail: conversionDetail(summary, today),
      accent: 'border-purple-300',
    },
    {
      label: 'Placement fees paid',
      value: formatCurrency(fees.paid),
      detail: `${formatCurrency(fees.invoiced)} invoiced, awaiting payment · ${formatCurrency(fees.not_invoiced)} not yet invoiced`,
      accent: 'border-green-300',
    },
  ]

  return (
    <section aria-labelledby="kpi-heading" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="kpi-heading" className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">Hiring partner results</h2>

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-lg bg-background px-4 py-3 border-l-4 ${k.accent}`}>
            <dt className="text-xs text-muted-text">{k.label}</dt>
            <dd className="text-2xl font-bold text-dark-text">{k.value}</dd>
            {k.detail && <dd className="text-xs text-muted-text mt-0.5">{k.detail}</dd>}
          </div>
        ))}
      </dl>

      <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
        Funnel · {summary.openCount} open
        {summary.referredCount > 0 && (
          <span className="normal-case font-normal"> · {summary.referredCount} with a referral source</span>
        )}
      </h3>
      <ol className="flex flex-col items-center gap-1.5">
        {OPEN_SALES_STAGES.map(stage => {
          const count = summary.stageCounts[stage]
          return (
            <li key={stage} className="w-full flex flex-col items-center">
              <div
                className={`${FUNNEL_BAR_COLORS[stage]} rounded-md h-9 flex items-center justify-center text-white text-xs font-semibold px-3 min-w-[10rem] transition-all`}
                style={{ width: `${30 + 70 * (count / maxCount)}%` }}
              >
                <span className="truncate">{SALES_STAGE_LABELS[stage]}: {count}</span>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex justify-center gap-3 mt-4 flex-wrap">
        <span className={`text-xs font-medium rounded-full px-3 py-1 ${SALES_STAGE_COLORS.closed_won}`}>
          {SALES_STAGE_LABELS.closed_won}: {summary.stageCounts.closed_won}
        </span>
        <span className={`text-xs font-medium rounded-full px-3 py-1 ${SALES_STAGE_COLORS.closed_lost}`}>
          {SALES_STAGE_LABELS.closed_lost}: {summary.stageCounts.closed_lost}
        </span>
      </div>
    </section>
  )
}

function SalesCycleKpis({ cycle, showOpenAge }: { cycle: ReturnType<typeof computeCycleStats>; showOpenAge: boolean }) {
  const describe = (stats: DurationStats, noun: string) =>
    stats.count > 0
      ? `average · median ${formatDays(stats.medianDays)} · ${stats.count} ${noun}`
      : `No ${noun} deals yet`
  const bySource = REFERRAL_SOURCES.flatMap(s => {
    const stats = cycle.introToCloseBySource[s]
    return stats ? [[s, stats] as const] : []
  })

  const kpis = [
    { label: 'Sales cycle (apprentice placed)', value: formatDays(cycle.salesCycleWon.averageDays), detail: describe(cycle.salesCycleWon, 'placed') },
    { label: 'Introduction to apprentice placed', value: formatDays(cycle.introToCloseWon.averageDays), detail: describe(cycle.introToCloseWon, 'introduced and placed') },
    { label: 'Sales cycle (referral fee paid)', value: formatDays(cycle.salesCycleLost.averageDays), detail: describe(cycle.salesCycleLost, 'referral fee paid') },
    {
      label: 'Open deals, time in pipeline',
      value: showOpenAge ? formatDays(cycle.openAge.averageDays) : '—',
      detail: showOpenAge ? describe(cycle.openAge, 'open') : null,
    },
  ]

  return (
    <section aria-labelledby="cycle-heading" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="cycle-heading" className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Sales cycle</h2>
      <p className="text-xs text-muted-text mb-4">
        Sales cycle runs from when a partner entered the pipeline to when it closed. Introduction to close starts at the introduction date, for any referral source.
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg bg-background px-4 py-3">
            <dt className="text-xs text-muted-text">{k.label}</dt>
            <dd className="text-2xl font-bold text-dark-text">{k.value}</dd>
            {k.detail && <dd className="text-xs text-muted-text mt-0.5">{k.detail}</dd>}
          </div>
        ))}
      </dl>
      {bySource.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Introduction to apprentice placed, by source</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-text">
                <th scope="col" className="font-medium py-1 pr-3">Source</th>
                <th scope="col" className="font-medium py-1 pr-3">Average</th>
                <th scope="col" className="font-medium py-1 pr-3">Median</th>
                <th scope="col" className="font-medium py-1">Placed</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map(([source, stats]) => (
                <tr key={source} className="border-t border-border text-dark-text">
                  <th scope="row" className="font-normal py-1.5 pr-3">{REFERRAL_SOURCE_LABELS[source]}</th>
                  <td className="py-1.5 pr-3">{formatDays(stats.averageDays)}</td>
                  <td className="py-1.5 pr-3">{formatDays(stats.medianDays)}</td>
                  <td className="py-1.5">{stats.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function dealTiming(deal: PipelineDeal, today: string | null): string | null {
  if (deal.isHistorical) return deal.closedOn ? `Closed ${formatDate(deal.closedOn)}` : null
  if (deal.closedOn) {
    const start = deal.startedOn ?? deal.introducedOn
    const closed = `Closed ${formatDate(deal.closedOn)}`
    return start ? `${closed} · ${formatDays(daysBetween(start, deal.closedOn))} cycle` : closed
  }
  if (deal.startedOn && today) return `${formatDays(daysBetween(deal.startedOn, today))} in pipeline`
  return null
}

function StageColumn({ stage, deals, firmNames, onOpen }: {
  stage: SalesStage
  deals: PipelineDeal[]
  firmNames: Map<string, string>
  onOpen: (partnerId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <section
      ref={setNodeRef}
      aria-label={`${SALES_STAGE_LABELS[stage]} stage`}
      className={`w-64 shrink-0 rounded-xl border-2 p-2 flex flex-col gap-2 min-h-[16rem] transition-colors ${
        isOver ? 'border-teal-primary bg-teal-light/40' : 'border-border bg-background'
      }`}
    >
      <header className="px-1 pt-1 flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${SALES_STAGE_COLORS[stage]}`}>
          {SALES_STAGE_LABELS[stage]}
        </span>
        <span className="text-xs text-muted-text">{deals.length}</span>
      </header>
      {deals.map(deal => (
        <DraggableDealCard
          key={deal.partnerId}
          deal={deal}
          firmName={firmNames.get(deal.introducedByPartnerId ?? '') ?? null}
          onOpen={onOpen}
        />
      ))}
    </section>
  )
}

function DraggableDealCard({ deal, firmName, onOpen }: {
  deal: PipelineDeal
  firmName: string | null
  onOpen: (partnerId: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.partnerId })

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(deal.partnerId)}
      aria-label={`${deal.partnerName}, ${SALES_STAGE_LABELS[deal.stage]}. Open to edit deal.`}
      className={`text-left ${isDragging ? 'opacity-40' : ''}`}
    >
      <DealCardBody deal={deal} firmName={firmName} />
    </button>
  )
}

function DealCardBody({ deal, firmName, dragging = false }: { deal: PipelineDeal; firmName: string | null; dragging?: boolean }) {
  const location = [deal.city, deal.state].filter(Boolean).join(', ')
  const timing = dealTiming(deal, useToday())
  const referral = describeReferral(deal, firmName)

  return (
    <div className={`rounded-lg border border-border bg-surface px-3 py-2.5 flex flex-col gap-1.5 cursor-grab hover:border-teal-primary/50 transition-colors ${
      dragging ? 'shadow-lg rotate-1 cursor-grabbing' : ''
    }`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-dark-text truncate">{deal.partnerName}</span>
        {deal.isHistorical && (
          <span
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
            title="Historical deal: left out of sales cycle timing"
          >
            Historical
          </span>
        )}
      </div>
      {(location || deal.companySegment) && (
        <span className="text-xs text-muted-text truncate">
          {[deal.companySegment ? COMPANY_SEGMENT_LABELS[deal.companySegment] : null, location || null].filter(Boolean).join(' · ')}
        </span>
      )}
      <PlacementSummary placements={deal.placements} />
      {referral && <span className="text-xs text-muted-text truncate">Introduced by {referral}</span>}
      {timing && <span className="text-xs text-muted-text">{timing}</span>}
      {deal.expectedCloseDate && !deal.closedOn && <span className="text-xs text-muted-text">Expected close {formatDate(deal.expectedCloseDate)}</span>}
      {/* {deal.ownerName && <span className="text-xs text-muted-text truncate">Owner: {deal.ownerName}</span>} */}
    </div>
  )
}

interface PlacementDraft {
  key: string
  term: PlacementTerm
  year: number
  count: string
  convertedCount: string
  feeAmount: string
  feeStatus: FeeStatus
}

let draftKeyCounter = 0
function nextDraftKey() {
  return `placement-${++draftKeyCounter}`
}

function newPlacementDraft(): PlacementDraft {
  const { term, year } = upcomingPlacementTerm(todayIso())
  return { key: nextDraftKey(), term, year, count: '1', convertedCount: '0', feeAmount: '', feeStatus: 'not_invoiced' }
}

function toPlacementDraft(p: ApprenticePlacement): PlacementDraft {
  return {
    key: nextDraftKey(),
    term: p.term,
    year: p.year,
    count: String(p.count),
    convertedCount: String(p.convertedCount),
    feeAmount: p.feeAmount != null ? String(p.feeAmount) : '',
    feeStatus: p.feeStatus,
  }
}

/** Validates the dialog's placement rows; returns an error message or the parsed placements. */
function parsePlacementDrafts(drafts: PlacementDraft[]): { error: string } | { placements: ApprenticePlacement[] } {
  const seen = new Set<string>()
  const placements: ApprenticePlacement[] = []
  for (const d of drafts) {
    const label = formatPlacementTerm(d)
    const count = Number(d.count)
    if (!Number.isInteger(count) || count < 1) {
      return { error: `Enter a whole number of apprentices placed (at least 1) for ${label}, or remove that term.` }
    }
    const converted = d.convertedCount.trim() === '' ? 0 : Number(d.convertedCount)
    if (!Number.isInteger(converted) || converted < 0 || converted > count) {
      return { error: `Converted apprentices for ${label} must be a whole number from 0 to ${count}.` }
    }
    const feeText = d.feeAmount.trim().replace(/[$,]/g, '')
    const fee = feeText === '' ? null : Number(feeText)
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) {
      return { error: `The placement fee for ${label} must be a positive amount.` }
    }
    const key = `${d.term}-${d.year}`
    if (seen.has(key)) return { error: `${label} is listed twice. Combine them into one row.` }
    seen.add(key)
    placements.push({ term: d.term, year: d.year, count, convertedCount: converted, feeAmount: fee, feeStatus: d.feeStatus })
  }
  return { placements: sortPlacements(placements) }
}

function EditDealModal({ deal, firms, onClose, onSave }: {
  deal: PipelineDeal
  firms: InvestorFirm[]
  onClose: () => void
  onSave: (update: SalesDealUpdate) => Promise<string | null>
}) {
  const [stage, setStage] = useState<SalesStage>(deal.stage)
  const [companySegment, setCompanySegment] = useState<CompanySegment | ''>(deal.companySegment ?? '')
  const [referralSource, setReferralSource] = useState<ReferralSource | ''>(deal.referralSource ?? '')
  const [referralDetail, setReferralDetail] = useState(deal.referralDetail ?? '')
  const [introducedBy, setIntroducedBy] = useState(deal.introducedByPartnerId ?? '')
  const [introducedOn, setIntroducedOn] = useState(deal.introducedOn ?? '')
  const [closeDate, setCloseDate] = useState(deal.expectedCloseDate ?? '')
  const [startedOn, setStartedOn] = useState(deal.startedOn ?? '')
  const [closedOn, setClosedOn] = useState(deal.closedOn ?? '')
  const [notes, setNotes] = useState(deal.notes ?? '')
  const [isHistorical, setIsHistorical] = useState(deal.isHistorical)
  const [placements, setPlacements] = useState<PlacementDraft[]>(() =>
    deal.stage === 'closed_won' && deal.placements.length === 0
      ? [newPlacementDraft()]
      : deal.placements.map(toPlacementDraft)
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function addPlacement() {
    setPlacements(ps => [...ps, newPlacementDraft()])
  }

  function updatePlacement(key: string, patch: Partial<PlacementDraft>) {
    setPlacements(ps => ps.map(p => p.key === key ? { ...p, ...patch } : p))
  }

  function changeStage(next: SalesStage) {
    setStage(next)
    if (isClosedStage(next) && !closedOn && !isHistorical) setClosedOn(todayIso())
    if (next === 'closed_won' && placements.length === 0) addPlacement()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parsePlacementDrafts(placements)
    if ('error' in parsed) {
      setFormError(parsed.error)
      return
    }

    const closed = isClosedStage(stage)
    if (referralSource === 'vc_pe' && !introducedBy) {
      setFormError('Choose the VC or PE firm that made the introduction.')
      return
    }
    const effectiveIntroOn = referralSource ? introducedOn : ''
    if (closed && closedOn) {
      if (startedOn && closedOn < startedOn) {
        setFormError('The close date can’t be before the date this partner entered the pipeline.')
        return
      }
      if (effectiveIntroOn && closedOn < effectiveIntroOn) {
        setFormError('The close date can’t be before the introduction date.')
        return
      }
    }
    setFormError(null)
    setSaving(true)
    const error = await onSave({
      stage,
      companySegment: companySegment || null,
      referralSource: referralSource || null,
      introducedByPartnerId: referralSource === 'vc_pe' ? introducedBy : null,
      referralDetail: referralSource && REFERRAL_DETAIL_LABELS[referralSource] ? referralDetail.trim() || null : null,
      introducedOn: effectiveIntroOn || null,
      ...(startedOn ? { startedOn } : {}),
      closedOn: closed ? closedOn || (isHistorical ? null : todayIso()) : null,
      expectedCloseDate: closeDate || null,
      notes,
      isHistorical,
      placements: parsed.placements,
    })
    setSaving(false)
    if (error) setFormError(`Couldn't save: ${error}`)
  }

  const currentYear = Number(todayIso().slice(0, 4))
  const yearOptions = [...new Set([
    ...Array.from({ length: 7 }, (_, i) => currentYear - 3 + i),
    ...placements.map(p => p.year),
  ])].sort((a, b) => a - b)

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary'
  const labelClass = 'flex flex-col gap-1 text-sm font-medium text-dark-text'
  const smallLabelClass = 'flex flex-col gap-1 text-xs font-medium text-muted-text'

  return (
    <Modal title={deal.partnerName} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Stage
          <select value={stage} onChange={e => changeStage(e.target.value as SalesStage)} className={inputClass}>
            {SALES_STAGES.map(s => <option key={s} value={s}>{SALES_STAGE_LABELS[s]}</option>)}
          </select>
        </label>

        <label className={labelClass}>
          Company size
          <select value={companySegment} onChange={e => setCompanySegment(e.target.value as CompanySegment | '')} className={inputClass}>
            <option value="">Not set</option>
            {COMPANY_SEGMENTS.map(s => <option key={s} value={s}>{COMPANY_SEGMENT_LABELS[s]}</option>)}
          </select>
          <span className="text-xs font-normal text-muted-text">Counts toward the outreach targets, by &ldquo;Entered pipeline&rdquo; date.</span>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-dark-text mb-1">Apprentices placed</legend>
          {placements.length === 0 ? (
            <p className="text-xs text-muted-text -mt-1">No apprentices placed yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {placements.map(p => {
                const label = formatPlacementTerm(p)
                return (
                  <li key={p.key} className="rounded-lg border border-border p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`term-${p.key}`}>Term</label>
                      <select
                        id={`term-${p.key}`}
                        value={p.term}
                        onChange={e => updatePlacement(p.key, { term: e.target.value as PlacementTerm })}
                        className={`${inputClass} flex-1`}
                      >
                        {PLACEMENT_TERMS.map(t => <option key={t} value={t}>{PLACEMENT_TERM_LABELS[t]}</option>)}
                      </select>
                      <label className="sr-only" htmlFor={`year-${p.key}`}>Year</label>
                      <select
                        id={`year-${p.key}`}
                        value={p.year}
                        onChange={e => updatePlacement(p.key, { year: Number(e.target.value) })}
                        className={`${inputClass} w-24`}
                      >
                        {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPlacements(ps => ps.filter(x => x.key !== p.key))}
                        className="text-muted-text hover:text-red-700 px-1 text-lg leading-none"
                        aria-label={`Remove ${label}`}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={smallLabelClass}>
                        Placed
                        <input
                          type="number" min={1} step={1} inputMode="numeric"
                          value={p.count}
                          onChange={e => updatePlacement(p.key, { count: e.target.value })}
                          aria-label={`Apprentices placed, ${label}`}
                          className={inputClass}
                        />
                      </label>
                      <label className={smallLabelClass}>
                        Converted
                        <input
                          type="number" min={0} step={1} inputMode="numeric"
                          value={p.convertedCount}
                          onChange={e => updatePlacement(p.key, { convertedCount: e.target.value })}
                          aria-label={`Apprentices converted, ${label}`}
                          className={inputClass}
                        />
                      </label>
                      <label className={smallLabelClass}>
                        Placement fee (USD)
                        <input
                          type="text" inputMode="decimal" placeholder="e.g. 10000"
                          value={p.feeAmount}
                          onChange={e => updatePlacement(p.key, { feeAmount: e.target.value })}
                          aria-label={`Placement fee, ${label}`}
                          className={inputClass}
                        />
                      </label>
                      <label className={smallLabelClass}>
                        Placement fee status
                        <select
                          value={p.feeStatus}
                          onChange={e => updatePlacement(p.key, { feeStatus: e.target.value as FeeStatus })}
                          aria-label={`Placement fee status, ${label}`}
                          className={inputClass}
                        >
                          {FEE_STATUSES.map(s => <option key={s} value={s}>{FEE_STATUS_LABELS[s]}</option>)}
                        </select>
                      </label>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="button" onClick={addPlacement} className="self-start text-sm text-teal-primary hover:underline">
            + Add a term
          </button>
        </fieldset>

        <label className={labelClass}>
          Introduced by
          <select value={referralSource} onChange={e => setReferralSource(e.target.value as ReferralSource | '')} className={inputClass}>
            <option value="">No referral source</option>
            {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{REFERRAL_SOURCE_LABELS[s]}</option>)}
          </select>
        </label>
        {referralSource === 'vc_pe' && (
          <label className={labelClass}>
            Firm
            <select value={introducedBy} onChange={e => setIntroducedBy(e.target.value)} className={inputClass}>
              <option value="">Choose a firm…</option>
              {firms.map(f => <option key={f.partnerId} value={f.partnerId}>{f.name}</option>)}
            </select>
            {firms.length === 0 && (
              <span className="text-xs font-normal text-muted-text">
                Tag a partner as Venture Capital or Private Equity to list it here.
              </span>
            )}
          </label>
        )}
        {referralSource && REFERRAL_DETAIL_LABELS[referralSource] && (
          <label className={labelClass}>
            {REFERRAL_DETAIL_LABELS[referralSource]}
            <input
              type="text"
              value={referralDetail}
              onChange={e => setReferralDetail(e.target.value)}
              maxLength={REFERRAL_DETAIL_MAX_LENGTH}
              placeholder="Optional"
              className={inputClass}
            />
          </label>
        )}
        {referralSource && (
          <label className={labelClass}>
            Introduction date
            <input type="date" value={introducedOn} onChange={e => setIntroducedOn(e.target.value)} className={inputClass} />
          </label>
        )}

        <label className={labelClass}>
          Entered pipeline
          <input type="date" value={startedOn} onChange={e => setStartedOn(e.target.value)} className={inputClass} />
          {!deal.startedOn && !isHistorical && (
            <span className="text-xs font-normal text-muted-text">Leave blank to use today&apos;s date.</span>
          )}
        </label>
        {isClosedStage(stage) ? (
          <label className={labelClass}>
            Closed on
            <input type="date" value={closedOn} onChange={e => setClosedOn(e.target.value)} className={inputClass} />
          </label>
        ) : (
          <label className={labelClass}>
            Expected close date
            <input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className={inputClass} />
          </label>
        )}
        <label className={labelClass}>
          Notes
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className={inputClass} />
        </label>

        <label className="flex items-start gap-2 text-sm text-dark-text">
          <input
            type="checkbox"
            checked={isHistorical}
            onChange={e => setIsHistorical(e.target.checked)}
            className="mt-0.5 accent-teal-primary"
          />
          <span>
            Historical deal
            <span className="block text-xs text-muted-text">
              Counts toward the funnel, placements and fees, but is left out of sales cycle timing. Untick once its dates are accurate.
            </span>
          </span>
        </label>

        {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}

        <div className="flex items-center justify-between gap-3">
          <Link href={`/instructor/partnerships/${deal.partnerId}`} className="text-xs text-teal-primary hover:underline">
            View partner →
          </Link>
          <div className="flex gap-2">
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
        </div>
      </form>
    </Modal>
  )
}

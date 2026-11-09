export const SALES_STAGES = [
  'lead',
  'contacted',
  'meeting_held',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const

export type SalesStage = (typeof SALES_STAGES)[number]

export const SALES_STAGE_LABELS: Record<SalesStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  meeting_held: 'Meeting Held',
  proposal_sent: 'Proposal Sent',
  negotiation: 'MOU Signed',
  closed_won: 'Apprentice Placed',
  closed_lost: 'Referral Fee Paid',
}

export const SALES_STAGE_COLORS: Record<SalesStage, string> = {
  lead:          'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/40',
  contacted:     'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/40',
  meeting_held:  'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/40',
  proposal_sent: 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700/40',
  negotiation:   'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/40',
  closed_won:    'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/40',
  closed_lost:   'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/40',
}

export const OPEN_SALES_STAGES: SalesStage[] = ['lead', 'contacted', 'meeting_held', 'proposal_sent', 'negotiation']

export function isSalesStage(value: unknown): value is SalesStage {
  return typeof value === 'string' && (SALES_STAGES as readonly string[]).includes(value)
}

export const LP_STATUSES = ['not_discussed', 'introduced', 'in_discussion', 'engaged', 'declined'] as const

export type LpStatus = (typeof LP_STATUSES)[number]

export const LP_STATUS_LABELS: Record<LpStatus, string> = {
  not_discussed: 'Not discussed',
  introduced: 'Introduced to LP strategy',
  in_discussion: 'In discussion',
  engaged: 'Engaged',
  declined: 'Declined',
}

export const LP_STATUS_COLORS: Record<LpStatus, string> = {
  not_discussed: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/40',
  introduced:    'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/40',
  in_discussion: 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700/40',
  engaged:       'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/40',
  declined:      'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/40',
}

export function isLpStatus(value: unknown): value is LpStatus {
  return typeof value === 'string' && (LP_STATUSES as readonly string[]).includes(value)
}

export const PLACEMENT_TERMS = ['january', 'may', 'september'] as const

export type PlacementTerm = (typeof PLACEMENT_TERMS)[number]

export const PLACEMENT_TERM_LABELS: Record<PlacementTerm, string> = {
  january: 'Jan',
  may: 'May',
  september: 'September',
}

export function isPlacementTerm(value: unknown): value is PlacementTerm {
  return typeof value === 'string' && (PLACEMENT_TERMS as readonly string[]).includes(value)
}

export const FEE_STATUSES = ['not_invoiced', 'invoiced', 'paid'] as const

export type FeeStatus = (typeof FEE_STATUSES)[number]

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  not_invoiced: 'Not invoiced',
  invoiced: 'Invoiced',
  paid: 'Paid',
}

export const FEE_STATUS_COLORS: Record<FeeStatus, string> = {
  not_invoiced: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  invoiced:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  paid:         'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
}

export function isFeeStatus(value: unknown): value is FeeStatus {
  return typeof value === 'string' && (FEE_STATUSES as readonly string[]).includes(value)
}

export interface ApprenticePlacement {
  term: PlacementTerm
  year: number
  /** Apprentices placed this term. */
  count: number
  /** How many of those apprentices converted to a hire; never more than `count`. */
  convertedCount: number
  /** Placement fee for this term in USD, if known. */
  feeAmount: number | null
  feeStatus: FeeStatus
}

export function formatPlacementTerm(p: Pick<ApprenticePlacement, 'term' | 'year'>): string {
  return `${PLACEMENT_TERM_LABELS[p.term]} ${p.year}`
}

/** Chronological order: by year, then January → May → September. */
export function sortPlacements<T extends Pick<ApprenticePlacement, 'term' | 'year'>>(placements: T[]): T[] {
  return [...placements].sort((a, b) => a.year - b.year || PLACEMENT_TERMS.indexOf(a.term) - PLACEMENT_TERMS.indexOf(b.term))
}

/** The current or next placement term for a YYYY-MM-DD date: Jan for January, May for Feb–May, September for Jun–Sep, next Jan after that. */
export function upcomingPlacementTerm(date: string): Pick<ApprenticePlacement, 'term' | 'year'> {
  const [year, month] = date.split('-').map(Number)
  if (month <= 1) return { term: 'january', year }
  if (month <= 5) return { term: 'may', year }
  if (month <= 9) return { term: 'september', year }
  return { term: 'january', year: year + 1 }
}

export interface PlacementTotals {
  placed: number
  converted: number
  /** Converted ÷ placed, or null when nothing has been placed. */
  conversionRate: number | null
  feesByStatus: Record<FeeStatus, number>
}

export function totalPlacements(placements: Pick<ApprenticePlacement, 'count' | 'convertedCount' | 'feeAmount' | 'feeStatus'>[]): PlacementTotals {
  const feesByStatus = { not_invoiced: 0, invoiced: 0, paid: 0 }
  let placed = 0
  let converted = 0
  for (const p of placements) {
    placed += p.count
    converted += p.convertedCount
    feesByStatus[p.feeStatus] += p.feeAmount ?? 0
  }
  return { placed, converted, conversionRate: placed > 0 ? converted / placed : null, feesByStatus }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

export type FirmKind = 'venture_capital' | 'private_equity'

export const FIRM_KIND_LABELS: Record<FirmKind, string> = {
  venture_capital: 'VC',
  private_equity: 'PE',
}

export interface PipelineDeal {
  partnerId: string
  partnerName: string
  city: string | null
  state: string | null
  ownerName: string | null
  stage: SalesStage
  introducedByPartnerId: string | null
  introducedOn: string | null
  startedOn: string | null
  closedOn: string | null
  expectedCloseDate: string | null
  notes: string | null
  placements: ApprenticePlacement[]
  /** Imported past deal: counts everywhere except the sales-cycle timing stats. */
  isHistorical: boolean
}

export function isClosedStage(stage: SalesStage): boolean {
  return stage === 'closed_won' || stage === 'closed_lost'
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Whole days from one YYYY-MM-DD date to another, unaffected by time zones or DST. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

export interface DurationStats {
  count: number
  averageDays: number | null
  medianDays: number | null
}

export function durationStats(days: number[]): DurationStats {
  const valid = days.filter(d => Number.isFinite(d) && d >= 0).sort((a, b) => a - b)
  if (valid.length === 0) return { count: 0, averageDays: null, medianDays: null }
  const mid = Math.floor(valid.length / 2)
  return {
    count: valid.length,
    averageDays: Math.round(valid.reduce((n, d) => n + d, 0) / valid.length),
    medianDays: valid.length % 2 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2),
  }
}

export interface CycleStats {
  salesCycleWon: DurationStats
  salesCycleLost: DurationStats
  introToCloseWon: DurationStats
  openAge: DurationStats
}

type CycleDeal = Pick<PipelineDeal, 'stage' | 'introducedOn' | 'startedOn' | 'closedOn'> & { isHistorical?: boolean }

/**
 * Sales cycle runs from pipeline entry to close; intro-to-close runs from a VC/PE introduction to close.
 * Historical deals are left out entirely.
 */
export function computeCycleStats(allDeals: CycleDeal[], today: string | null = null): CycleStats {
  const deals = allDeals.filter(d => !d.isHistorical)
  const won = deals.filter(d => d.stage === 'closed_won' && d.closedOn)
  const lost = deals.filter(d => d.stage === 'closed_lost' && d.closedOn)
  const open = today ? deals.filter(d => !isClosedStage(d.stage) && d.startedOn) : []

  return {
    salesCycleWon: durationStats(won.filter(d => d.startedOn).map(d => daysBetween(d.startedOn!, d.closedOn!))),
    salesCycleLost: durationStats(lost.filter(d => d.startedOn).map(d => daysBetween(d.startedOn!, d.closedOn!))),
    introToCloseWon: durationStats(won.filter(d => d.introducedOn).map(d => daysBetween(d.introducedOn!, d.closedOn!))),
    openAge: durationStats(open.map(d => daysBetween(d.startedOn!, today!))),
  }
}

export function formatDays(days: number | null): string {
  if (days === null) return '—'
  return `${days} day${days === 1 ? '' : 's'}`
}

export interface FirmOption {
  partnerId: string
  name: string
}

export interface InvestorFirm {
  partnerId: string
  name: string
  kinds: FirmKind[]
  ownerName: string | null
  lpStatus: LpStatus
  lpNotes: string | null
}

export interface PipelineSummary extends PlacementTotals {
  stageCounts: Record<SalesStage, number>
  openCount: number
  /** Partners with at least one apprentice placed. */
  hiringPartners: number
  /** Partners with at least one apprentice converted. */
  convertingPartners: number
  introducedByFirms: number
}

type SummaryDeal = Pick<PipelineDeal, 'stage' | 'introducedByPartnerId' | 'placements'>

export function summarizePipeline(deals: SummaryDeal[]): PipelineSummary {
  const stageCounts = Object.fromEntries(SALES_STAGES.map(s => [s, 0])) as Record<SalesStage, number>
  let hiringPartners = 0
  let convertingPartners = 0
  let introducedByFirms = 0

  for (const deal of deals) {
    stageCounts[deal.stage]++
    const totals = totalPlacements(deal.placements)
    if (totals.placed > 0) hiringPartners++
    if (totals.converted > 0) convertingPartners++
    if (deal.introducedByPartnerId) introducedByFirms++
  }

  return {
    ...totalPlacements(deals.flatMap(d => d.placements)),
    stageCounts,
    openCount: OPEN_SALES_STAGES.reduce((n, s) => n + stageCounts[s], 0),
    hiringPartners,
    convertingPartners,
    introducedByFirms,
  }
}

export interface FirmSummary {
  firmCount: number
  introductionCount: number
  lpCounts: Record<LpStatus, number>
}

export function summarizeFirms(firms: Pick<InvestorFirm, 'partnerId' | 'lpStatus'>[], deals: Pick<PipelineDeal, 'introducedByPartnerId'>[]): FirmSummary {
  const firmIds = new Set(firms.map(f => f.partnerId))
  const lpCounts = Object.fromEntries(LP_STATUSES.map(s => [s, 0])) as Record<LpStatus, number>
  for (const firm of firms) lpCounts[firm.lpStatus]++

  return {
    firmCount: firms.length,
    introductionCount: deals.filter(d => d.introducedByPartnerId && firmIds.has(d.introducedByPartnerId)).length,
    lpCounts,
  }
}

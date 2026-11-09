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

export const COMPANY_SEGMENTS = ['growth_stage', 'enterprise'] as const

export type CompanySegment = (typeof COMPANY_SEGMENTS)[number]

export const COMPANY_SEGMENT_LABELS: Record<CompanySegment, string> = {
  growth_stage: 'Growth stage',
  enterprise: 'Enterprise',
}

export function isCompanySegment(value: unknown): value is CompanySegment {
  return typeof value === 'string' && (COMPANY_SEGMENTS as readonly string[]).includes(value)
}

export const REFERRAL_SOURCES = [
  'vc_pe',
  'client_referral',
  'funding_partner',
  'board_advisor',
  'personal_network',
  'event',
  'inbound',
] as const

export type ReferralSource = (typeof REFERRAL_SOURCES)[number]

export const REFERRAL_SOURCE_LABELS: Record<ReferralSource, string> = {
  vc_pe: 'VC/PE firm',
  client_referral: 'Client referral',
  funding_partner: 'Funding partner',
  board_advisor: 'Board member / advisor',
  personal_network: 'Staff / personal network',
  event: 'Event / conference',
  inbound: 'Inbound',
}

/** Sources that take a typed-in name, and what to call it. */
export const REFERRAL_DETAIL_LABELS: Partial<Record<ReferralSource, string>> = {
  client_referral: 'Client name',
  funding_partner: 'Funding partner name',
}

export const REFERRAL_DETAIL_MAX_LENGTH = 200

export function isReferralSource(value: unknown): value is ReferralSource {
  return typeof value === 'string' && (REFERRAL_SOURCES as readonly string[]).includes(value)
}

/** Card text, e.g. "Client referral: Acme Corp" or, for a VC/PE introduction, the firm's name. */
export function describeReferral(
  deal: Pick<PipelineDeal, 'referralSource' | 'referralDetail'>,
  firmName: string | null,
): string | null {
  if (!deal.referralSource) return null
  if (deal.referralSource === 'vc_pe') return firmName ?? REFERRAL_SOURCE_LABELS.vc_pe
  const label = REFERRAL_SOURCE_LABELS[deal.referralSource]
  return deal.referralDetail ? `${label}: ${deal.referralDetail}` : label
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

const PLACEMENT_TERM_START_MONTH: Record<PlacementTerm, number> = { january: 1, may: 5, september: 9 }

/** A placement lasts this many months from the 1st of its term's month. */
export const PLACEMENT_LENGTH_MONTHS = 4

export type PlacementPhase = 'upcoming' | 'in_placement' | 'finished'

/** YYYY-MM-DD dates a term's placement starts and finishes (the finish date is the first day it's over). */
export function placementPeriod(p: Pick<ApprenticePlacement, 'term' | 'year'>): { start: string; end: string } {
  const startMonth = PLACEMENT_TERM_START_MONTH[p.term]
  const endIndex = startMonth - 1 + PLACEMENT_LENGTH_MONTHS
  const iso = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`
  return {
    start: iso(p.year, startMonth),
    end: iso(p.year + Math.floor(endIndex / 12), (endIndex % 12) + 1),
  }
}

export function placementPhase(p: Pick<ApprenticePlacement, 'term' | 'year'>, today: string): PlacementPhase {
  const { start, end } = placementPeriod(p)
  if (today < start) return 'upcoming'
  return today < end ? 'in_placement' : 'finished'
}

export interface PlacementTotals {
  placed: number
  /** All conversions, including any from placements that haven't finished. */
  converted: number
  /** Apprentices whose placement has finished; the conversion rate's denominator. */
  finishedPlaced: number
  finishedConverted: number
  /** Converted ÷ placed for finished placements only; null when none have finished or today isn't known. */
  conversionRate: number | null
  /** Apprentices in a placement that has started but not finished. */
  inPlacement: number
  /** Apprentices in a term that hasn't started yet. */
  upcoming: number
  feesByStatus: Record<FeeStatus, number>
}

type TotalsPlacement = Pick<ApprenticePlacement, 'term' | 'year' | 'count' | 'convertedCount' | 'feeAmount' | 'feeStatus'>

/** Without `today`, nothing can be called finished, so the conversion rate is null. */
export function totalPlacements(placements: TotalsPlacement[], today: string | null = null): PlacementTotals {
  const feesByStatus = { not_invoiced: 0, invoiced: 0, paid: 0 }
  let placed = 0
  let converted = 0
  let finishedPlaced = 0
  let finishedConverted = 0
  let inPlacement = 0
  let upcoming = 0
  for (const p of placements) {
    placed += p.count
    converted += p.convertedCount
    feesByStatus[p.feeStatus] += p.feeAmount ?? 0
    if (!today) continue
    const phase = placementPhase(p, today)
    if (phase === 'finished') {
      finishedPlaced += p.count
      finishedConverted += p.convertedCount
    } else if (phase === 'in_placement') {
      inPlacement += p.count
    } else {
      upcoming += p.count
    }
  }
  return {
    placed,
    converted,
    finishedPlaced,
    finishedConverted,
    conversionRate: finishedPlaced > 0 ? finishedConverted / finishedPlaced : null,
    inPlacement,
    upcoming,
    feesByStatus,
  }
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
  companySegment: CompanySegment | null
  referralSource: ReferralSource | null
  /** Typed-in name for a client or funding partner referral. */
  referralDetail: string | null
  /** The VC/PE firm, when `referralSource` is `vc_pe`. */
  introducedByPartnerId: string | null
  /** Referral date, for any source. */
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
  /** Intro-to-close for each referral source; only sources with at least one measured deal. */
  introToCloseBySource: Partial<Record<ReferralSource, DurationStats>>
  openAge: DurationStats
}

type CycleDeal = Pick<PipelineDeal, 'stage' | 'introducedOn' | 'startedOn' | 'closedOn'> & {
  isHistorical?: boolean
  referralSource?: ReferralSource | null
}

/**
 * Sales cycle runs from pipeline entry to close; intro-to-close runs from the referral date to close.
 * Historical deals are left out entirely.
 */
export function computeCycleStats(allDeals: CycleDeal[], today: string | null = null): CycleStats {
  const deals = allDeals.filter(d => !d.isHistorical)
  const won = deals.filter(d => d.stage === 'closed_won' && d.closedOn)
  const lost = deals.filter(d => d.stage === 'closed_lost' && d.closedOn)
  const open = today ? deals.filter(d => !isClosedStage(d.stage) && d.startedOn) : []
  const introduced = won.filter(d => d.introducedOn)
  const introDays = (ds: CycleDeal[]) => ds.map(d => daysBetween(d.introducedOn!, d.closedOn!))

  const introToCloseBySource: CycleStats['introToCloseBySource'] = {}
  for (const source of REFERRAL_SOURCES) {
    const stats = durationStats(introDays(introduced.filter(d => d.referralSource === source)))
    if (stats.count > 0) introToCloseBySource[source] = stats
  }

  return {
    salesCycleWon: durationStats(won.filter(d => d.startedOn).map(d => daysBetween(d.startedOn!, d.closedOn!))),
    salesCycleLost: durationStats(lost.filter(d => d.startedOn).map(d => daysBetween(d.startedOn!, d.closedOn!))),
    introToCloseWon: durationStats(introDays(introduced)),
    introToCloseBySource,
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
  referralCounts: Record<ReferralSource, number>
  /** Deals with any referral source. */
  referredCount: number
}

type SummaryDeal = Pick<PipelineDeal, 'stage' | 'referralSource' | 'placements'>

/** `today` is needed for the conversion rate and in-placement counts; see `totalPlacements`. */
export function summarizePipeline(deals: SummaryDeal[], today: string | null = null): PipelineSummary {
  const stageCounts = Object.fromEntries(SALES_STAGES.map(s => [s, 0])) as Record<SalesStage, number>
  const referralCounts = Object.fromEntries(REFERRAL_SOURCES.map(s => [s, 0])) as Record<ReferralSource, number>
  let hiringPartners = 0
  let convertingPartners = 0
  let referredCount = 0

  for (const deal of deals) {
    stageCounts[deal.stage]++
    const totals = totalPlacements(deal.placements)
    if (totals.placed > 0) hiringPartners++
    if (totals.converted > 0) convertingPartners++
    if (deal.referralSource) {
      referralCounts[deal.referralSource]++
      referredCount++
    }
  }

  return {
    ...totalPlacements(deals.flatMap(d => d.placements), today),
    stageCounts,
    openCount: OPEN_SALES_STAGES.reduce((n, s) => n + stageCounts[s], 0),
    hiringPartners,
    convertingPartners,
    referralCounts,
    referredCount,
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

export interface OutreachTarget {
  id: string
  segment: CompanySegment
  targetCount: number
  /** Inclusive YYYY-MM-DD dates. */
  startDate: string
  endDate: string
}

export type TargetStatus = 'upcoming' | 'on_track' | 'behind' | 'met' | 'missed'

export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  upcoming: 'Not started',
  on_track: 'On track',
  behind: 'Behind pace',
  met: 'Target met',
  missed: 'Ended below target',
}

export const TARGET_STATUS_COLORS: Record<TargetStatus, string> = {
  upcoming: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  on_track: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  behind:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  met:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  missed:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export interface TargetProgress {
  /** Deals of the target's company size whose "Entered pipeline" date is within the period. */
  added: Pick<PipelineDeal, 'partnerId' | 'partnerName' | 'startedOn'>[]
  addedCount: number
  remaining: number
  /** Null when today isn't known (server render). */
  status: TargetStatus | null
  /** Days left in the period, counting today; 0 once it has ended. */
  daysLeft: number | null
  /** Where an even pace through the period would be by today, rounded down. */
  expectedByNow: number | null
}

type TargetDeal = Pick<PipelineDeal, 'partnerId' | 'partnerName' | 'startedOn' | 'companySegment'>

/** "On track" means at least where an even pace from the start date would be by today. */
export function computeTargetProgress(target: OutreachTarget, deals: TargetDeal[], today: string | null): TargetProgress {
  const added = deals
    .filter(d => d.companySegment === target.segment && d.startedOn && d.startedOn >= target.startDate && d.startedOn <= target.endDate)
    .sort((a, b) => a.startedOn!.localeCompare(b.startedOn!) || a.partnerName.localeCompare(b.partnerName))
    .map(({ partnerId, partnerName, startedOn }) => ({ partnerId, partnerName, startedOn }))
  const addedCount = added.length
  const remaining = Math.max(0, target.targetCount - addedCount)

  if (!today) return { added, addedCount, remaining, status: null, daysLeft: null, expectedByNow: null }

  const totalDays = daysBetween(target.startDate, target.endDate) + 1
  const elapsedDays = today < target.startDate ? 0 : today > target.endDate ? totalDays : daysBetween(target.startDate, today) + 1
  const expectedByNow = Math.floor((target.targetCount * elapsedDays) / totalDays)
  const daysLeft = today > target.endDate ? 0 : daysBetween(today < target.startDate ? target.startDate : today, target.endDate) + 1

  let status: TargetStatus
  if (addedCount >= target.targetCount) status = 'met'
  else if (today < target.startDate) status = 'upcoming'
  else if (today > target.endDate) status = 'missed'
  else status = addedCount >= expectedByNow ? 'on_track' : 'behind'

  return { added, addedCount, remaining, status, daysLeft, expectedByNow }
}

/** Targets whose period includes today or hasn't started come first (soonest end first), then past ones (latest first). */
export function sortTargets(targets: OutreachTarget[], today: string | null): OutreachTarget[] {
  const ended = (t: OutreachTarget) => (today !== null && t.endDate < today ? 1 : 0)
  return [...targets].sort((a, b) =>
    ended(a) - ended(b)
    || (ended(a) ? b.endDate.localeCompare(a.endDate) : a.endDate.localeCompare(b.endDate))
    || COMPANY_SEGMENTS.indexOf(a.segment) - COMPANY_SEGMENTS.indexOf(b.segment)
  )
}

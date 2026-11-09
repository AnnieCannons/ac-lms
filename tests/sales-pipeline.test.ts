import { describe, it, expect } from 'vitest'
import {
  summarizePipeline, summarizeFirms, isSalesStage, isLpStatus, isFeeStatus,
  daysBetween, durationStats, computeCycleStats, describeReferral,
  sortPlacements, formatPlacementTerm, totalPlacements, upcomingPlacementTerm, isPlacementTerm,
  placementPeriod, placementPhase, computeTargetProgress, sortTargets,
  type SalesStage, type LpStatus, type ApprenticePlacement, type ReferralSource,
  type OutreachTarget, type CompanySegment,
} from '@/lib/sales-pipeline'

const placement = (overrides: Partial<ApprenticePlacement> = {}): ApprenticePlacement => ({
  term: 'january', year: 2027, count: 1, convertedCount: 0, feeAmount: null, feeStatus: 'not_invoiced', ...overrides,
})

const deal = (
  stage: SalesStage,
  opts: { placements?: ApprenticePlacement[]; referralSource?: ReferralSource | null } = {},
) => ({
  stage,
  placements: opts.placements ?? [],
  referralSource: opts.referralSource ?? null,
})

describe('summarizePipeline', () => {
  it('counts every stage, even when empty', () => {
    const summary = summarizePipeline([])
    expect(Object.keys(summary.stageCounts)).toEqual([
      'lead', 'contacted', 'meeting_held', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost',
    ])
    expect(summary.openCount).toBe(0)
    expect(summary.hiringPartners).toBe(0)
    expect(summary.conversionRate).toBeNull()
  })

  it('keeps closed deals out of the open count', () => {
    const summary = summarizePipeline([deal('lead'), deal('negotiation'), deal('closed_won'), deal('closed_lost')])
    expect(summary.openCount).toBe(2)
    expect(summary.stageCounts.closed_won).toBe(1)
  })

  it('totals placements, conversions and partners across deals', () => {
    const summary = summarizePipeline([
      deal('closed_won', { placements: [placement({ count: 3, convertedCount: 2 }), placement({ term: 'may', count: 1 })] }),
      deal('closed_won', { placements: [placement({ count: 4, convertedCount: 0 })] }),
      deal('lead'),
    ], '2028-01-01')
    expect(summary.placed).toBe(8)
    expect(summary.converted).toBe(2)
    expect(summary.conversionRate).toBe(0.25)
    expect(summary.hiringPartners).toBe(2)
    expect(summary.convertingPartners).toBe(1)
  })

  it('totals placement fees by status, treating a missing amount as zero', () => {
    const summary = summarizePipeline([
      deal('closed_won', {
        placements: [
          placement({ feeAmount: 10000, feeStatus: 'paid' }),
          placement({ term: 'may', feeAmount: 5000, feeStatus: 'invoiced' }),
          placement({ term: 'september', feeAmount: null, feeStatus: 'paid' }),
        ],
      }),
      deal('closed_won', { placements: [placement({ feeAmount: 2500, feeStatus: 'paid' })] }),
    ])
    expect(summary.feesByStatus).toEqual({ not_invoiced: 0, invoiced: 5000, paid: 12500 })
  })

  it('counts deals by referral source', () => {
    const summary = summarizePipeline([
      deal('lead', { referralSource: 'vc_pe' }),
      deal('lead', { referralSource: 'client_referral' }),
      deal('contacted', { referralSource: 'client_referral' }),
      deal('lead'),
    ])
    expect(summary.referredCount).toBe(3)
    expect(summary.referralCounts.client_referral).toBe(2)
    expect(summary.referralCounts.vc_pe).toBe(1)
    expect(summary.referralCounts.inbound).toBe(0)
  })
})

describe('describeReferral', () => {
  const ref = (referralSource: ReferralSource | null, referralDetail: string | null = null) => ({ referralSource, referralDetail })

  it('names the firm for a VC/PE introduction, falling back to the source label', () => {
    expect(describeReferral(ref('vc_pe'), 'Sequoia')).toBe('Sequoia')
    expect(describeReferral(ref('vc_pe'), null)).toBe('VC/PE firm')
  })

  it('adds the typed-in name when there is one', () => {
    expect(describeReferral(ref('client_referral', 'Acme Corp'), null)).toBe('Client referral: Acme Corp')
    expect(describeReferral(ref('funding_partner'), null)).toBe('Funding partner')
    expect(describeReferral(ref('inbound'), null)).toBe('Inbound')
    expect(describeReferral(ref(null), 'Sequoia')).toBeNull()
  })
})

describe('summarizeFirms', () => {
  it('counts firms by LP status and only introductions from listed firms', () => {
    const firms: { partnerId: string; lpStatus: LpStatus }[] = [
      { partnerId: 'a', lpStatus: 'engaged' },
      { partnerId: 'b', lpStatus: 'not_discussed' },
    ]
    const summary = summarizeFirms(firms, [
      { introducedByPartnerId: 'a' },
      { introducedByPartnerId: 'a' },
      { introducedByPartnerId: 'gone' },
      { introducedByPartnerId: null },
    ])
    expect(summary.firmCount).toBe(2)
    expect(summary.introductionCount).toBe(2)
    expect(summary.lpCounts).toEqual({ not_discussed: 1, introduced: 0, in_discussion: 0, engaged: 1, declined: 0 })
  })
})

describe('daysBetween', () => {
  it('counts whole days, including across a DST change and year end', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(3)
    expect(daysBetween('2026-05-01', '2026-05-01')).toBe(0)
  })
})

describe('durationStats', () => {
  it('returns nulls when there is nothing to measure', () => {
    expect(durationStats([])).toEqual({ count: 0, averageDays: null, medianDays: null })
  })

  it('computes a rounded average and the median for odd and even counts', () => {
    expect(durationStats([10, 30, 20])).toEqual({ count: 3, averageDays: 20, medianDays: 20 })
    expect(durationStats([10, 20, 30, 41])).toEqual({ count: 4, averageDays: 25, medianDays: 25 })
  })

  it('ignores negative durations from inconsistent dates', () => {
    expect(durationStats([-5, 10]).count).toBe(1)
  })
})

describe('computeCycleStats', () => {
  const cycleDeal = (stage: SalesStage, startedOn: string | null, closedOn: string | null, introducedOn: string | null = null) =>
    ({ stage, startedOn, closedOn, introducedOn })

  it('measures won and lost cycles from pipeline entry to close', () => {
    const stats = computeCycleStats([
      cycleDeal('closed_won', '2026-01-01', '2026-01-31'),
      cycleDeal('closed_won', '2026-02-01', '2026-02-11'),
      cycleDeal('closed_lost', '2026-01-01', '2026-01-06'),
    ])
    expect(stats.salesCycleWon).toEqual({ count: 2, averageDays: 20, medianDays: 20 })
    expect(stats.salesCycleLost.averageDays).toBe(5)
  })

  it('measures introduction to close only for won deals with an introduction date', () => {
    const stats = computeCycleStats([
      cycleDeal('closed_won', '2026-01-10', '2026-02-09', '2026-01-01'),
      cycleDeal('closed_won', '2026-01-10', '2026-02-09'),
      cycleDeal('closed_lost', '2026-01-10', '2026-02-09', '2026-01-01'),
    ])
    expect(stats.introToCloseWon).toEqual({ count: 1, averageDays: 39, medianDays: 39 })
  })

  it('breaks introduction to close down by referral source', () => {
    const referred = (referralSource: ReferralSource, introducedOn: string, closedOn: string) =>
      ({ ...cycleDeal('closed_won', null, closedOn, introducedOn), referralSource })
    const stats = computeCycleStats([
      referred('client_referral', '2026-01-01', '2026-01-11'),
      referred('client_referral', '2026-01-01', '2026-01-31'),
      referred('vc_pe', '2026-01-01', '2026-01-06'),
      { ...cycleDeal('negotiation', null, null, '2026-01-01'), referralSource: 'inbound' as const },
    ])
    expect(stats.introToCloseWon.count).toBe(3)
    expect(stats.introToCloseBySource).toEqual({
      vc_pe: { count: 1, averageDays: 5, medianDays: 5 },
      client_referral: { count: 2, averageDays: 20, medianDays: 20 },
    })
  })

  it('measures open deal age only when today is known', () => {
    const deals = [cycleDeal('negotiation', '2026-03-01', null), cycleDeal('lead', null, null)]
    expect(computeCycleStats(deals, '2026-03-11').openAge).toEqual({ count: 1, averageDays: 10, medianDays: 10 })
    expect(computeCycleStats(deals).openAge.count).toBe(0)
  })

  it('leaves historical deals out of every timing stat', () => {
    const historical = (stage: SalesStage, startedOn: string | null, closedOn: string | null, introducedOn: string | null = null) =>
      ({ ...cycleDeal(stage, startedOn, closedOn, introducedOn), isHistorical: true })
    const stats = computeCycleStats([
      cycleDeal('closed_won', '2026-01-01', '2026-01-11', '2026-01-01'),
      historical('closed_won', '2020-01-01', '2026-11-07', '2020-01-01'),
      historical('closed_lost', '2020-01-01', '2020-01-02'),
      historical('lead', '2020-01-01', null),
    ], '2026-11-07')
    expect(stats.salesCycleWon).toEqual({ count: 1, averageDays: 10, medianDays: 10 })
    expect(stats.introToCloseWon).toEqual({ count: 1, averageDays: 10, medianDays: 10 })
    expect(stats.salesCycleLost.count).toBe(0)
    expect(stats.openAge.count).toBe(0)
  })
})

describe('apprentice placements', () => {
  it('sorts by year, then Jan → May → September', () => {
    const sorted = sortPlacements([
      { term: 'september', year: 2026 },
      { term: 'january', year: 2027 },
      { term: 'january', year: 2026 },
      { term: 'may', year: 2026 },
    ] as const)
    expect(sorted.map(formatPlacementTerm)).toEqual(['Jan 2026', 'May 2026', 'September 2026', 'Jan 2027'])
  })

  it('computes a conversion rate per set of placements', () => {
    const totals = totalPlacements([placement({ count: 2, convertedCount: 1 }), placement({ count: 2, convertedCount: 2 })], '2028-01-01')
    expect(totals).toMatchObject({ placed: 4, converted: 3, conversionRate: 0.75 })
  })

  it('runs each placement four months from the 1st of its term', () => {
    expect(placementPeriod({ term: 'january', year: 2026 })).toEqual({ start: '2026-01-01', end: '2026-05-01' })
    expect(placementPeriod({ term: 'may', year: 2026 })).toEqual({ start: '2026-05-01', end: '2026-09-01' })
    expect(placementPeriod({ term: 'september', year: 2026 })).toEqual({ start: '2026-09-01', end: '2027-01-01' })
    expect(placementPhase({ term: 'september', year: 2026 }, '2026-11-09')).toBe('in_placement')
    expect(placementPhase({ term: 'september', year: 2026 }, '2026-12-31')).toBe('in_placement')
    expect(placementPhase({ term: 'september', year: 2026 }, '2027-01-01')).toBe('finished')
    expect(placementPhase({ term: 'january', year: 2027 }, '2026-11-09')).toBe('upcoming')
  })

  it('leaves unfinished placements out of the conversion rate but still counts them', () => {
    const totals = totalPlacements([
      placement({ term: 'may', year: 2026, count: 4, convertedCount: 3 }),
      placement({ term: 'september', year: 2026, count: 5, convertedCount: 1 }),
      placement({ term: 'january', year: 2027, count: 2 }),
    ], '2026-11-09')
    expect(totals).toMatchObject({
      placed: 11, converted: 4,
      finishedPlaced: 4, finishedConverted: 3, conversionRate: 0.75,
      inPlacement: 5, upcoming: 2,
    })
  })

  it('has no conversion rate before any placement finishes, or without today', () => {
    const placements = [placement({ term: 'september', year: 2026, count: 3, convertedCount: 1 })]
    expect(totalPlacements(placements, '2026-11-09').conversionRate).toBeNull()
    expect(totalPlacements(placements).conversionRate).toBeNull()
    expect(totalPlacements(placements).inPlacement).toBe(0)
  })

  it('picks the current or next term for a date', () => {
    expect(upcomingPlacementTerm('2026-01-20')).toEqual({ term: 'january', year: 2026 })
    expect(upcomingPlacementTerm('2026-02-01')).toEqual({ term: 'may', year: 2026 })
    expect(upcomingPlacementTerm('2026-09-30')).toEqual({ term: 'september', year: 2026 })
    expect(upcomingPlacementTerm('2026-11-07')).toEqual({ term: 'january', year: 2027 })
  })

  it('accepts only the three terms', () => {
    expect(isPlacementTerm('may')).toBe(true)
    expect(isPlacementTerm('june')).toBe(false)
  })
})

describe('validators', () => {
  it('accept known values and reject anything else', () => {
    expect(isSalesStage('meeting_held')).toBe(true)
    expect(isSalesStage('Meeting Held')).toBe(false)
    expect(isLpStatus('in_discussion')).toBe(true)
    expect(isLpStatus(undefined)).toBe(false)
    expect(isFeeStatus('invoiced')).toBe(true)
    expect(isFeeStatus('overdue')).toBe(false)
  })
})

describe('outreach targets', () => {
  const target = (overrides: Partial<OutreachTarget> = {}): OutreachTarget => ({
    id: 't1', segment: 'growth_stage', targetCount: 20, startDate: '2026-11-09', endDate: '2027-05-08', ...overrides,
  })
  const company = (partnerId: string, companySegment: CompanySegment | null, startedOn: string | null) =>
    ({ partnerId, partnerName: partnerId, companySegment, startedOn })

  it('counts only matching companies that entered the pipeline within the dates, inclusive', () => {
    const progress = computeTargetProgress(target(), [
      company('first-day', 'growth_stage', '2026-11-09'),
      company('last-day', 'growth_stage', '2027-05-08'),
      company('before', 'growth_stage', '2026-11-08'),
      company('after', 'growth_stage', '2027-05-09'),
      company('enterprise', 'enterprise', '2026-12-01'),
      company('unsized', null, '2026-12-01'),
      company('never-saved', 'growth_stage', null),
    ], '2026-12-01')
    expect(progress.added.map(d => d.partnerId)).toEqual(['first-day', 'last-day'])
    expect(progress.remaining).toBe(18)
  })

  it('compares progress with an even pace through the period', () => {
    // 2026-11-09 to 2027-05-08 is 181 days; by 2027-02-06 (day 90) an even pace is floor(20 * 90 / 181) = 9.
    const deals = Array.from({ length: 9 }, (_, i) => company(`c${i}`, 'growth_stage', '2026-12-01'))
    const onTrack = computeTargetProgress(target(), deals, '2027-02-06')
    expect(onTrack).toMatchObject({ expectedByNow: 9, status: 'on_track', daysLeft: 92 })
    expect(computeTargetProgress(target(), deals.slice(1), '2027-02-06').status).toBe('behind')
  })

  it('reports upcoming, met and missed targets', () => {
    const one = [company('a', 'enterprise', '2026-12-01')]
    expect(computeTargetProgress(target({ segment: 'enterprise', targetCount: 5 }), one, '2026-11-01'))
      .toMatchObject({ status: 'upcoming', expectedByNow: 0, daysLeft: 181 })
    expect(computeTargetProgress(target({ segment: 'enterprise', targetCount: 1 }), one, '2026-12-02').status).toBe('met')
    expect(computeTargetProgress(target({ segment: 'enterprise', targetCount: 5 }), one, '2027-06-01'))
      .toMatchObject({ status: 'missed', daysLeft: 0 })
    expect(computeTargetProgress(target(), one, null)).toMatchObject({ status: null, daysLeft: null })
  })

  it('lists current and upcoming targets before past ones', () => {
    const sorted = sortTargets([
      target({ id: 'past', endDate: '2026-10-31', startDate: '2026-05-01' }),
      target({ id: 'enterprise', segment: 'enterprise' }),
      target({ id: 'growth' }),
      target({ id: 'next', startDate: '2027-05-09', endDate: '2027-11-08' }),
    ], '2026-11-09')
    expect(sorted.map(t => t.id)).toEqual(['growth', 'enterprise', 'next', 'past'])
  })
})

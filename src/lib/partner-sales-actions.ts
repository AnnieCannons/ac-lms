'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  isSalesStage, isLpStatus, isPlacementTerm, isFeeStatus, isReferralSource, isCompanySegment, sortPlacements,
  REFERRAL_DETAIL_LABELS, REFERRAL_DETAIL_MAX_LENGTH,
  type PipelineDeal, type InvestorFirm, type FirmKind, type SalesStage, type LpStatus,
  type ApprenticePlacement, type ReferralSource, type CompanySegment, type OutreachTarget,
} from '@/lib/sales-pipeline'

const FIRM_TYPES: FirmKind[] = ['venture_capital', 'private_equity']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function requireStaffOrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, supabase: null, user: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Not authorized' as const, supabase: null, user: null }
  }

  return { error: null, supabase, user }
}

type StaffSupabase = NonNullable<Awaited<ReturnType<typeof requireStaffOrAdmin>>['supabase']>

interface DealRow {
  stage: string
  company_segment: string | null
  referral_source: string | null
  referral_detail: string | null
  introduced_by_partner_id: string | null
  introduced_on: string | null
  started_on: string | null
  closed_on: string | null
  expected_close_date: string | null
  notes: string | null
  is_historical: boolean | null
}

interface PlacementRow {
  term: string
  year: number
  count: number
  converted_count: number | null
  fee_amount: number | string | null
  fee_status: string | null
}

// PostgREST returns a one-to-one embed as an object, but older clients/types may give an array.
function firstOrSelf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function partnerHasType(supabase: StaffSupabase, partnerId: string, types: string[]) {
  const { data } = await supabase
    .from('partner_type_assignments')
    .select('partner_id')
    .eq('partner_id', partnerId)
    .in('partner_type', types)
    .limit(1)
  return (data ?? []).length > 0
}

export async function getSalesPipelineData(): Promise<{
  error: string | null
  deals: PipelineDeal[]
  firms: InvestorFirm[]
  targets: OutreachTarget[]
}> {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error, deals: [], firms: [], targets: [] }

  const [dealsResult, firmsResult, targetsResult] = await Promise.all([
    supabase
      .from('partners')
      .select(`
        id, name, city, state,
        owner:users!partners_internal_owner_id_fkey (name),
        partner_type_assignments!inner (partner_type),
        partner_sales_deals!partner_sales_deals_partner_id_fkey (
          stage, company_segment, referral_source, referral_detail, introduced_by_partner_id, introduced_on, started_on, closed_on, expected_close_date, notes, is_historical
        ),
        partner_apprentice_placements (term, year, count, converted_count, fee_amount, fee_status)
      `)
      .eq('partner_type_assignments.partner_type', 'apprenticeship')
      .order('name'),
    supabase
      .from('partners')
      .select(`
        id, name,
        owner:users!partners_internal_owner_id_fkey (name),
        partner_type_assignments!inner (partner_type),
        partner_investor_firms (lp_status, lp_notes)
      `)
      .in('partner_type_assignments.partner_type', FIRM_TYPES)
      .order('name'),
    supabase
      .from('partner_outreach_targets')
      .select('id, segment, target_count, start_date, end_date')
      .order('end_date'),
  ])

  const failed = dealsResult.error ?? firmsResult.error ?? targetsResult.error
  if (failed) return { error: failed.message, deals: [], firms: [], targets: [] }

  const deals = (dealsResult.data ?? []).map((p): PipelineDeal => {
    const deal = firstOrSelf(p.partner_sales_deals as DealRow | DealRow[] | null)
    const owner = firstOrSelf(p.owner as { name: string | null } | { name: string | null }[] | null)
    return {
      partnerId: p.id,
      partnerName: p.name,
      city: p.city,
      state: p.state,
      ownerName: owner?.name ?? null,
      stage: deal && isSalesStage(deal.stage) ? deal.stage : 'lead',
      companySegment: deal && isCompanySegment(deal.company_segment) ? deal.company_segment : null,
      referralSource: deal && isReferralSource(deal.referral_source) ? deal.referral_source : null,
      referralDetail: deal?.referral_detail ?? null,
      introducedByPartnerId: deal?.introduced_by_partner_id ?? null,
      introducedOn: deal?.introduced_on ?? null,
      startedOn: deal?.started_on ?? null,
      closedOn: deal?.closed_on ?? null,
      expectedCloseDate: deal?.expected_close_date ?? null,
      notes: deal?.notes ?? null,
      isHistorical: deal?.is_historical ?? false,
      placements: sortPlacements(
        ((p.partner_apprentice_placements ?? []) as PlacementRow[])
          .filter(row => isPlacementTerm(row.term))
          .map((row): ApprenticePlacement => ({
            term: row.term as ApprenticePlacement['term'],
            year: row.year,
            count: row.count,
            convertedCount: row.converted_count ?? 0,
            feeAmount: row.fee_amount != null ? Number(row.fee_amount) : null,
            feeStatus: isFeeStatus(row.fee_status) ? row.fee_status : 'not_invoiced',
          }))
      ),
    }
  })

  const firms = (firmsResult.data ?? []).map((p): InvestorFirm => {
    const row = firstOrSelf(p.partner_investor_firms as { lp_status: string; lp_notes: string | null } | { lp_status: string; lp_notes: string | null }[] | null)
    const owner = firstOrSelf(p.owner as { name: string | null } | { name: string | null }[] | null)
    const kinds = (p.partner_type_assignments as { partner_type: string }[])
      .map(t => t.partner_type)
      .filter((t): t is FirmKind => (FIRM_TYPES as string[]).includes(t))
    return {
      partnerId: p.id,
      name: p.name,
      kinds,
      ownerName: owner?.name ?? null,
      lpStatus: row && isLpStatus(row.lp_status) ? row.lp_status : 'not_discussed',
      lpNotes: row?.lp_notes ?? null,
    }
  })

  const targets = ((targetsResult.data ?? []) as TargetRow[])
    .filter(t => isCompanySegment(t.segment))
    .map(toOutreachTarget)

  return { error: null, deals, firms, targets }
}

interface TargetRow {
  id: string
  segment: string
  target_count: number
  start_date: string
  end_date: string
}

function toOutreachTarget(t: TargetRow): OutreachTarget {
  return {
    id: t.id,
    segment: t.segment as OutreachTarget['segment'],
    targetCount: t.target_count,
    startDate: t.start_date,
    endDate: t.end_date,
  }
}

export interface SalesDealUpdate {
  stage?: SalesStage
  companySegment?: CompanySegment | null
  /**
   * Saving the referral replaces it as a whole: send the source with the firm (for `vc_pe`)
   * or name (for client and funding partner referrals). `null` clears the referral and its date.
   */
  referralSource?: ReferralSource | null
  referralDetail?: string | null
  introducedByPartnerId?: string | null
  introducedOn?: string | null
  startedOn?: string | null
  closedOn?: string | null
  expectedCloseDate?: string | null
  notes?: string | null
  isHistorical?: boolean
  /** Replaces all of the partner's placements when provided. */
  placements?: ApprenticePlacement[]
}

function normalizePlacements(input: unknown): { error: string } | { placements: ApprenticePlacement[] } {
  if (!Array.isArray(input)) return { error: 'Invalid apprentice placements' }
  const seen = new Set<string>()
  const placements: ApprenticePlacement[] = []
  for (const p of input as Partial<ApprenticePlacement>[]) {
    if (!isPlacementTerm(p?.term)) return { error: 'Invalid placement term' }
    const year = p.year!
    const count = p.count!
    const converted = p.convertedCount ?? 0
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Invalid placement year' }
    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      return { error: 'Number of apprentices placed must be a whole number of at least 1' }
    }
    if (!Number.isInteger(converted) || converted < 0 || converted > count) {
      return { error: 'Converted apprentices must be a whole number no larger than the number placed' }
    }
    const fee = p.feeAmount ?? null
    if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return { error: 'Placement fee must be a positive amount' }
    if (!isFeeStatus(p.feeStatus)) return { error: 'Invalid placement fee status' }

    const key = `${p.term}-${year}`
    if (seen.has(key)) return { error: 'Each term can only be listed once' }
    seen.add(key)
    placements.push({ term: p.term, year, count, convertedCount: converted, feeAmount: fee, feeStatus: p.feeStatus })
  }
  return { placements: sortPlacements(placements) }
}

export async function updateSalesDeal(partnerId: string, update: SalesDealUpdate) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase || !user) return { error }

  let placements: ApprenticePlacement[] | undefined
  if (update.placements !== undefined) {
    const result = normalizePlacements(update.placements)
    if ('error' in result) return { error: result.error }
    placements = result.placements
  }

  const row: Record<string, unknown> = { partner_id: partnerId, updated_by: user.id }

  if (update.stage !== undefined) {
    if (!isSalesStage(update.stage)) return { error: 'Invalid stage' }
    row.stage = update.stage
  }
  if (update.companySegment !== undefined) {
    if (update.companySegment !== null && !isCompanySegment(update.companySegment)) return { error: 'Invalid company size' }
    row.company_segment = update.companySegment
  }
  if (update.introducedOn !== undefined) {
    const d = update.introducedOn
    if (d !== null && !DATE_RE.test(d)) return { error: 'Invalid introduction date' }
    row.introduced_on = d
  }
  if (update.startedOn !== undefined) {
    const d = update.startedOn
    if (d !== null && !DATE_RE.test(d)) return { error: 'Invalid pipeline entry date' }
    row.started_on = d
  }
  if (update.closedOn !== undefined) {
    const d = update.closedOn
    if (d !== null && !DATE_RE.test(d)) return { error: 'Invalid close date' }
    row.closed_on = d
  }
  for (const start of [update.startedOn, update.introducedOn]) {
    if (start && update.closedOn && update.closedOn < start) {
      return { error: 'The close date can’t be before the introduction or pipeline entry date' }
    }
  }
  if (update.expectedCloseDate !== undefined) {
    const d = update.expectedCloseDate
    if (d !== null && !DATE_RE.test(d)) return { error: 'Invalid expected close date' }
    row.expected_close_date = d
  }
  if (update.notes !== undefined) {
    row.notes = update.notes?.trim() || null
  }
  if (update.isHistorical !== undefined) {
    if (typeof update.isHistorical !== 'boolean') return { error: 'Invalid historical flag' }
    row.is_historical = update.isHistorical
  }

  if (!(await partnerHasType(supabase, partnerId, ['apprenticeship']))) {
    return { error: 'Only Apprenticeship partners can be in the sales pipeline' }
  }

  if (update.referralSource === undefined) {
    if (update.introducedByPartnerId !== undefined || update.referralDetail !== undefined) {
      return { error: 'A referral must be saved with its source' }
    }
  } else {
    const source = update.referralSource
    if (source !== null && !isReferralSource(source)) return { error: 'Invalid referral source' }
    row.referral_source = source
    row.introduced_by_partner_id = null
    row.referral_detail = null

    if (source === null) {
      row.introduced_on = null
    } else if (source === 'vc_pe') {
      const firmId = update.introducedByPartnerId
      if (!firmId) return { error: 'Choose the VC or PE firm that made the introduction' }
      if (firmId === partnerId) return { error: 'A partner can’t introduce itself' }
      if (!(await partnerHasType(supabase, firmId, FIRM_TYPES))) {
        return { error: 'Introductions can only come from a VC or PE firm' }
      }
      row.introduced_by_partner_id = firmId
    } else if (REFERRAL_DETAIL_LABELS[source]) {
      const detail = update.referralDetail?.trim() || null
      if (detail && detail.length > REFERRAL_DETAIL_MAX_LENGTH) {
        return { error: `${REFERRAL_DETAIL_LABELS[source]} must be ${REFERRAL_DETAIL_MAX_LENGTH} characters or fewer` }
      }
      row.referral_detail = detail
    }
  }

  const { error: dbError } = await supabase
    .from('partner_sales_deals')
    .upsert(row, { onConflict: 'partner_id' })

  if (dbError) return { error: dbError.message }

  if (placements !== undefined) {
    const { error: deleteError } = await supabase
      .from('partner_apprentice_placements')
      .delete()
      .eq('partner_id', partnerId)
    if (deleteError) return { error: deleteError.message }

    if (placements.length > 0) {
      const { error: insertError } = await supabase
        .from('partner_apprentice_placements')
        .insert(placements.map(p => ({
          partner_id: partnerId,
          term: p.term,
          year: p.year,
          count: p.count,
          converted_count: p.convertedCount,
          fee_amount: p.feeAmount,
          fee_status: p.feeStatus,
          created_by: user.id,
        })))
      if (insertError) return { error: insertError.message }
    }
  }

  revalidatePath('/instructor/partnerships/pipeline')
  return { error: null }
}

export interface InvestorFirmUpdate {
  lpStatus?: LpStatus
  lpNotes?: string | null
}

export async function updateInvestorFirm(partnerId: string, update: InvestorFirmUpdate) {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase || !user) return { error }

  const row: Record<string, unknown> = { partner_id: partnerId, updated_by: user.id }

  if (update.lpStatus !== undefined) {
    if (!isLpStatus(update.lpStatus)) return { error: 'Invalid LP status' }
    row.lp_status = update.lpStatus
  }
  if (update.lpNotes !== undefined) {
    row.lp_notes = update.lpNotes?.trim() || null
  }

  if (!(await partnerHasType(supabase, partnerId, FIRM_TYPES))) {
    return { error: 'Only VC or PE firms can have an LP status' }
  }

  const { error: dbError } = await supabase
    .from('partner_investor_firms')
    .upsert(row, { onConflict: 'partner_id' })

  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/pipeline')
  return { error: null }
}

export interface OutreachTargetInput {
  segment: CompanySegment
  targetCount: number
  startDate: string
  endDate: string
}

/** Creates a target when `id` is null, otherwise updates it. */
export async function saveOutreachTarget(
  id: string | null,
  input: OutreachTargetInput,
): Promise<{ error: string | null; target: OutreachTarget | null }> {
  const { error, supabase, user } = await requireStaffOrAdmin()
  if (error || !supabase || !user) return { error, target: null }

  if (!isCompanySegment(input.segment)) return { error: 'Invalid company size', target: null }
  if (!Number.isInteger(input.targetCount) || input.targetCount < 1 || input.targetCount > 10000) {
    return { error: 'The target must be a whole number of at least 1', target: null }
  }
  if (!DATE_RE.test(input.startDate) || !DATE_RE.test(input.endDate)) return { error: 'Invalid dates', target: null }
  if (input.endDate < input.startDate) return { error: 'The end date can’t be before the start date', target: null }

  const row = {
    segment: input.segment,
    target_count: input.targetCount,
    start_date: input.startDate,
    end_date: input.endDate,
  }
  const query = id
    ? supabase.from('partner_outreach_targets').update(row).eq('id', id)
    : supabase.from('partner_outreach_targets').insert({ ...row, created_by: user.id })
  const { data, error: dbError } = await query.select('id, segment, target_count, start_date, end_date').single()

  if (dbError || !data) return { error: dbError?.message ?? 'Target not found', target: null }

  revalidatePath('/instructor/partnerships/pipeline')
  return { error: null, target: toOutreachTarget(data as TargetRow) }
}

export async function deleteOutreachTarget(id: string): Promise<{ error: string | null }> {
  const { error, supabase } = await requireStaffOrAdmin()
  if (error || !supabase) return { error }

  const { error: dbError } = await supabase.from('partner_outreach_targets').delete().eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidatePath('/instructor/partnerships/pipeline')
  return { error: null }
}

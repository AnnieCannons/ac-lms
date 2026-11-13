/**
 * Import historical Sales Pipeline deals from a CSV.
 *
 * Every imported deal is marked historical (`partner_sales_deals.is_historical`):
 * it counts toward the funnel, apprentices placed/converted and placement fees,
 * but is left out of all sales-cycle timing. Untick "Historical deal" in the
 * deal dialog later for any deal whose dates you trust.
 *
 * CSV columns (header row required; names are case-insensitive, spaces or underscores):
 *   partner          required. Matched to an existing partner by name (case-insensitive)
 *   stage            required. A stage label ("Apprentice Placed", "Referral Fee Paid", "MOU Signed", ...) or key
 *   company_size     optional. Growth stage or Enterprise; counts toward outreach targets by started_on
 *   referral_source  optional. VC/PE firm, Client referral, Funding partner, Board member / advisor,
 *                    Staff / personal network, Event / conference or Inbound (labels or keys)
 *   introduced_by    optional. Name of a partner tagged Venture Capital or Private Equity; implies VC/PE firm,
 *                    so referral_source can be left blank
 *   referral_detail  optional. Client or funding partner name, for those two sources only
 *   introduced_on    optional. Referral date, YYYY-MM-DD or M/D/YYYY (likewise for the other dates)
 *   started_on       optional. When the partner entered the pipeline
 *   closed_on        optional. Only kept for Apprentice Placed / Referral Fee Paid
 *   notes            optional
 *   term             optional. Jan, May or September (or "Jan 2025", in which case year can be blank)
 *   year             required when term is given
 *   placed           required when term is given. Whole number, at least 1
 *   converted        optional. Whole number from 0 to placed. Default 0
 *   placement_fee    optional. e.g. 10000 or $10,000
 *   fee_status       optional. Not invoiced, Invoiced or Paid. Default Not invoiced
 *
 * Use one row per partner per term; a partner with several terms gets several rows,
 * with the deal columns filled in on any one of them (filled-in values must agree).
 * A partner with no placements gets a single row with the term columns blank.
 *
 * Partners that already have a live (non-historical) deal are skipped so real
 * pipeline data isn't overwritten; pass --overwrite to import over them anyway.
 * Re-running the same file is safe: deals are updated and placements are matched
 * on partner + term + year.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/import-pipeline-history.ts <file.csv> --dry-run
 *   source .env.local && npx ts-node --esm scripts/import-pipeline-history.ts <file.csv>
 * Flags:
 *   --dry-run          check the file and show what would be imported, without writing
 *   --create-partners  create any partner not found, as an Apprenticeship partner with status "active"
 *   --overwrite        also import over partners that already have a live deal
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import {
  SALES_STAGES, SALES_STAGE_LABELS, FEE_STATUSES, FEE_STATUS_LABELS, isClosedStage, formatPlacementTerm,
  REFERRAL_SOURCES, REFERRAL_SOURCE_LABELS, REFERRAL_DETAIL_LABELS, REFERRAL_DETAIL_MAX_LENGTH,
  COMPANY_SEGMENTS, COMPANY_SEGMENT_LABELS,
  type SalesStage, type FeeStatus, type PlacementTerm, type ApprenticePlacement, type ReferralSource, type CompanySegment,
} from '../src/lib/sales-pipeline.ts'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const CREATE_PARTNERS = args.includes('--create-partners')
const OVERWRITE = args.includes('--overwrite')
const filePath = args.find(a => !a.startsWith('--'))

if (!filePath) {
  console.error('Usage: npx ts-node --esm scripts/import-pipeline-history.ts <file.csv> [--dry-run] [--create-partners] [--overwrite]')
  process.exit(1)
}

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── CSV ──────────────────────────────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

const COLUMNS = [
  'partner', 'stage', 'company_size', 'referral_source', 'introduced_by', 'referral_detail', 'introduced_on', 'started_on', 'closed_on', 'notes',
  'term', 'year', 'placed', 'converted', 'placement_fee', 'fee_status',
] as const
type Column = (typeof COLUMNS)[number]
type Row = Record<Column, string> & { line: number }

function readRows(text: string): Row[] {
  const [header, ...body] = parseCsv(text)
  if (!header) throw new Error('The file is empty')
  const index = new Map(header.map((h, i) => [h.trim().toLowerCase().replace(/[\s-]+/g, '_'), i]))
  const unknown = [...index.keys()].filter(h => !(COLUMNS as readonly string[]).includes(h))
  if (unknown.length > 0) throw new Error(`Unknown column(s): ${unknown.join(', ')}. Expected: ${COLUMNS.join(', ')}`)
  for (const required of ['partner', 'stage'] as const) {
    if (!index.has(required)) throw new Error(`Missing required column "${required}"`)
  }
  return body.map((cells, i) => {
    const row = { line: i + 2 } as Row
    for (const col of COLUMNS) {
      const at = index.get(col)
      row[col] = at === undefined ? '' : (cells[at] ?? '').trim()
    }
    return row
  })
}

// ─── Field parsing ────────────────────────────────────────────────────────────

const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ')

function parseStage(raw: string): SalesStage | null {
  const n = normalize(raw)
  return SALES_STAGES.find(s => normalize(s) === n || normalize(SALES_STAGE_LABELS[s]) === n) ?? null
}

/** Matches a key or label ignoring case and punctuation, so "Board member/advisor" and "vc_pe" both work. */
function parseReferralSource(raw: string): ReferralSource | null {
  const loose = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  const n = loose(raw)
  return REFERRAL_SOURCES.find(s => loose(s) === n || loose(REFERRAL_SOURCE_LABELS[s]) === n) ?? null
}

function parseFeeStatus(raw: string): FeeStatus | null {
  if (!raw) return 'not_invoiced'
  const n = normalize(raw)
  return FEE_STATUSES.find(s => normalize(s) === n || normalize(FEE_STATUS_LABELS[s]) === n) ?? null
}

const TERM_ALIASES: Record<string, PlacementTerm> = {
  jan: 'january', january: 'january',
  may: 'may',
  sep: 'september', sept: 'september', september: 'september',
}

function parseTerm(raw: string, rawYear: string): { term: PlacementTerm; year: number } | string {
  const match = raw.trim().toLowerCase().match(/^([a-z]+)\.?\s*(\d{4})?$/)
  const term = match ? TERM_ALIASES[match[1]] : undefined
  if (!term) return `unknown term "${raw}" (use Jan, May or September)`
  const yearText = rawYear || match?.[2] || ''
  const year = Number(yearText)
  if (!yearText || !Number.isInteger(year) || year < 2000 || year > 2100) return `missing or invalid year for term "${raw}"`
  if (match?.[2] && rawYear && Number(match[2]) !== year) return `term "${raw}" doesn't match year ${rawYear}`
  return { term, year }
}

function parseDate(raw: string): string | null | undefined {
  if (!raw) return null
  let y: number, m: number, d: number
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
  else if (us) [y, m, d] = [Number(us[3]), Number(us[1]), Number(us[2])]
  else return undefined
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseWhole(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  return Number(raw)
}

// ─── Grouping and validation ──────────────────────────────────────────────────

interface PlannedDeal {
  partnerName: string
  partnerId: string | null
  stage: SalesStage
  companySegment: CompanySegment | null
  referralSource: ReferralSource | null
  referralDetail: string | null
  introducedByName: string | null
  introducedById: string | null
  introducedOn: string | null
  startedOn: string | null
  closedOn: string | null
  notes: string | null
  placements: ApprenticePlacement[]
}

type DealColumn = 'stage' | 'company_size' | 'referral_source' | 'introduced_by' | 'referral_detail' | 'introduced_on' | 'started_on' | 'closed_on' | 'notes'
const DEAL_COLUMNS: DealColumn[] = ['stage', 'company_size', 'referral_source', 'introduced_by', 'referral_detail', 'introduced_on', 'started_on', 'closed_on', 'notes']

function planDeals(rows: Row[], errors: string[]): PlannedDeal[] {
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    if (!row.partner) { errors.push(`Line ${row.line}: partner is blank`); continue }
    const key = row.partner.toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const deals: PlannedDeal[] = []
  for (const group of groups.values()) {
    const name = group[0].partner
    const err = (line: number, msg: string) => errors.push(`Line ${line} (${name}): ${msg}`)
    const startErrors = errors.length

    const values = {} as Record<DealColumn, string>
    for (const col of DEAL_COLUMNS) {
      const filled = group.filter(r => r[col] !== '')
      const distinct = [...new Set(filled.map(r => r[col]))]
      if (distinct.length > 1) err(filled[0].line, `rows disagree on ${col} (${distinct.map(v => `"${v}"`).join(' vs ')})`)
      values[col] = distinct[0] ?? ''
    }

    const stage = parseStage(values.stage)
    if (!values.stage) err(group[0].line, 'stage is blank')
    else if (!stage) err(group[0].line, `unknown stage "${values.stage}" (use one of: ${SALES_STAGES.map(s => SALES_STAGE_LABELS[s]).join(', ')})`)

    const dates: Partial<Record<'introduced_on' | 'started_on' | 'closed_on', string | null>> = {}
    for (const col of ['introduced_on', 'started_on', 'closed_on'] as const) {
      const parsed = parseDate(values[col])
      if (parsed === undefined) err(group[0].line, `invalid ${col} "${values[col]}" (use YYYY-MM-DD or M/D/YYYY)`)
      else dates[col] = parsed
    }
    const looseText = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
    const companySegment = values.company_size
      ? COMPANY_SEGMENTS.find(s => looseText(s) === looseText(values.company_size) || looseText(COMPANY_SEGMENT_LABELS[s]) === looseText(values.company_size)) ?? null
      : null
    if (values.company_size && !companySegment) {
      err(group[0].line, `unknown company_size "${values.company_size}" (use Growth stage or Enterprise)`)
    }

    let referralSource: ReferralSource | null = null
    if (values.referral_source) {
      referralSource = parseReferralSource(values.referral_source)
      if (!referralSource) {
        err(group[0].line, `unknown referral_source "${values.referral_source}" (use one of: ${REFERRAL_SOURCES.map(s => REFERRAL_SOURCE_LABELS[s]).join(', ')})`)
      }
    } else if (values.introduced_by) {
      referralSource = 'vc_pe'
    }
    if (values.introduced_by && referralSource && referralSource !== 'vc_pe') {
      err(group[0].line, 'introduced_by names a VC/PE firm, so referral_source must be VC/PE firm or blank')
    }
    if (referralSource === 'vc_pe' && !values.introduced_by) err(group[0].line, 'referral_source is VC/PE firm but introduced_by is blank')
    if (values.referral_detail) {
      if (!referralSource || !REFERRAL_DETAIL_LABELS[referralSource]) {
        err(group[0].line, `referral_detail is only kept for ${REFERRAL_SOURCE_LABELS.client_referral} or ${REFERRAL_SOURCE_LABELS.funding_partner}`)
      } else if (values.referral_detail.length > REFERRAL_DETAIL_MAX_LENGTH) {
        err(group[0].line, `referral_detail must be ${REFERRAL_DETAIL_MAX_LENGTH} characters or fewer`)
      }
    }
    if (dates.introduced_on && !values.referral_source && !values.introduced_by) {
      err(group[0].line, 'introduced_on is set but there is no referral_source or introduced_by')
    }
    if (dates.closed_on && stage && !isClosedStage(stage)) {
      err(group[0].line, `closed_on is only kept for ${SALES_STAGE_LABELS.closed_won} or ${SALES_STAGE_LABELS.closed_lost}`)
    }
    for (const start of [dates.started_on, dates.introduced_on]) {
      if (start && dates.closed_on && dates.closed_on < start) err(group[0].line, 'closed_on is before started_on or introduced_on')
    }

    const placements: ApprenticePlacement[] = []
    const seenTerms = new Set<string>()
    for (const row of group) {
      const termFields = [row.term, row.year, row.placed, row.converted, row.placement_fee, row.fee_status]
      if (!row.term) {
        if (termFields.some(Boolean)) err(row.line, 'placement columns are filled in but term is blank')
        continue
      }
      const termYear = parseTerm(row.term, row.year)
      if (typeof termYear === 'string') { err(row.line, termYear); continue }
      const label = formatPlacementTerm(termYear)
      const key = `${termYear.term}-${termYear.year}`
      if (seenTerms.has(key)) { err(row.line, `${label} is listed more than once`); continue }
      seenTerms.add(key)

      const count = parseWhole(row.placed)
      if (count === null || count < 1 || count > 1000) { err(row.line, `placed for ${label} must be a whole number of at least 1`); continue }
      const converted = row.converted ? parseWhole(row.converted) : 0
      if (converted === null || converted > count) { err(row.line, `converted for ${label} must be a whole number from 0 to ${count}`); continue }
      const feeText = row.placement_fee.replace(/[$,\s]/g, '')
      const fee = feeText === '' ? null : Number(feeText)
      if (fee !== null && (!Number.isFinite(fee) || fee < 0)) { err(row.line, `invalid placement_fee "${row.placement_fee}" for ${label}`); continue }
      const feeStatus = parseFeeStatus(row.fee_status)
      if (!feeStatus) { err(row.line, `unknown fee_status "${row.fee_status}" (use Not invoiced, Invoiced or Paid)`); continue }

      placements.push({ ...termYear, count, convertedCount: converted, feeAmount: fee, feeStatus })
    }

    if (errors.length > startErrors || !stage) continue
    deals.push({
      partnerName: name,
      partnerId: null,
      stage,
      companySegment,
      referralSource,
      referralDetail: values.referral_detail || null,
      introducedByName: values.introduced_by || null,
      introducedById: null,
      introducedOn: dates.introduced_on ?? null,
      startedOn: dates.started_on ?? null,
      closedOn: dates.closed_on ?? null,
      notes: values.notes || null,
      placements,
    })
  }
  return deals
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface PartnerRow {
  id: string
  name: string
  partner_type_assignments: { partner_type: string }[] | null
  partner_sales_deals: { is_historical: boolean | null } | { is_historical: boolean | null }[] | null
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes' : '🚀 Importing historical pipeline deals...')

  const errors: string[] = []
  let rows: Row[]
  try {
    rows = readRows(readFileSync(resolve(filePath!), 'utf8'))
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`)
    process.exit(1)
  }
  console.log(`Read ${rows.length} row(s) from ${filePath}`)

  const deals = planDeals(rows, errors)

  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('id, name, partner_type_assignments (partner_type), partner_sales_deals!partner_sales_deals_partner_id_fkey (is_historical)')
  if (partnersError) {
    console.error(`✗ Couldn't load partners: ${partnersError.message}`)
    if (partnersError.message.includes('is_historical')) {
      console.error('  Run supabase/migrations/20261107020000_pipeline_historical_deals.sql in the Supabase SQL editor first.')
    }
    process.exit(1)
  }

  const byName = new Map<string, PartnerRow[]>()
  for (const p of (partners ?? []) as PartnerRow[]) {
    const key = p.name.trim().toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), p])
  }
  const typesOf = (p: PartnerRow) => (p.partner_type_assignments ?? []).map(t => t.partner_type)

  const toCreate: PlannedDeal[] = []
  const skipped: string[] = []
  const ready: PlannedDeal[] = []

  for (const deal of deals) {
    const matches = byName.get(deal.partnerName.toLowerCase()) ?? []
    if (matches.length > 1) { errors.push(`${deal.partnerName}: ${matches.length} partners have this name; merge or rename them first`); continue }

    if (deal.introducedByName) {
      const firms = (byName.get(deal.introducedByName.toLowerCase()) ?? [])
        .filter(f => typesOf(f).some(t => t === 'venture_capital' || t === 'private_equity'))
      if (firms.length !== 1) {
        errors.push(`${deal.partnerName}: introduced_by "${deal.introducedByName}" ${firms.length ? 'matches more than one firm' : 'isn’t a partner tagged Venture Capital or Private Equity'}`)
        continue
      }
      if (matches[0] && firms[0].id === matches[0].id) { errors.push(`${deal.partnerName}: a partner can’t introduce itself`); continue }
      deal.introducedById = firms[0].id
    }

    const partner = matches[0]
    if (!partner) {
      if (CREATE_PARTNERS) { toCreate.push(deal); ready.push(deal) }
      else errors.push(`${deal.partnerName}: no partner with this name (fix the spelling, or pass --create-partners)`)
      continue
    }
    if (!typesOf(partner).includes('apprenticeship')) {
      errors.push(`${deal.partnerName}: isn’t tagged Apprenticeship, so it wouldn’t appear in the pipeline; tag it Apprenticeship first`)
      continue
    }
    const existing = Array.isArray(partner.partner_sales_deals) ? partner.partner_sales_deals[0] : partner.partner_sales_deals
    if (existing && !existing.is_historical && !OVERWRITE) {
      skipped.push(deal.partnerName)
      continue
    }
    deal.partnerId = partner.id
    ready.push(deal)
  }

  if (errors.length > 0) {
    console.log(`\n✗ Found ${errors.length} problem(s); nothing was imported. Fix these and run again:`)
    errors.forEach(e => console.log(`  ✗ ${e}`))
    process.exit(1)
  }

  for (const deal of ready) {
    const placed = deal.placements.length
      ? deal.placements.map(p => `${formatPlacementTerm(p)}: ${p.count} placed, ${p.convertedCount} converted, fee ${p.feeAmount ?? 'not set'} (${FEE_STATUS_LABELS[p.feeStatus]})`).join('; ')
      : 'no placements'
    const created = deal.partnerId ? '' : ' [new partner]'
    const referral = deal.referralSource
      ? `; introduced by ${deal.referralSource === 'vc_pe' ? deal.introducedByName : REFERRAL_SOURCE_LABELS[deal.referralSource]}${deal.referralDetail ? `: ${deal.referralDetail}` : ''}`
      : ''
    console.log(`→ ${deal.partnerName}${created}: ${SALES_STAGE_LABELS[deal.stage]}${referral}; ${placed}`)
  }
  if (skipped.length > 0) {
    console.log(`\n↷ Skipping ${skipped.length} partner(s) that already have a live deal (pass --overwrite to import over them):`)
    skipped.forEach(s => console.log(`  ↷ ${s}`))
  }

  if (DRY_RUN) {
    console.log(`\n🔍 Would import ${ready.length} historical deal(s)${toCreate.length ? `, creating ${toCreate.length} partner(s)` : ''}. Run without --dry-run to import.`)
    return
  }

  const failures: string[] = []
  let imported = 0

  for (const deal of ready) {
    if (!deal.partnerId) {
      const { data: newPartner, error } = await supabase
        .from('partners')
        .insert({ name: deal.partnerName, status: 'active', tags: [], multi_city: false })
        .select('id')
        .single()
      if (error || !newPartner) { failures.push(`${deal.partnerName}: couldn’t create partner: ${error?.message}`); continue }
      const { error: typeError } = await supabase
        .from('partner_type_assignments')
        .upsert({ partner_id: newPartner.id, partner_type: 'apprenticeship' }, { onConflict: 'partner_id,partner_type' })
      if (typeError) { failures.push(`${deal.partnerName}: created partner but couldn’t tag it Apprenticeship: ${typeError.message}`); continue }
      deal.partnerId = newPartner.id
    }

    const row: Record<string, unknown> = {
      partner_id: deal.partnerId,
      stage: deal.stage,
      company_segment: deal.companySegment,
      referral_source: deal.referralSource,
      referral_detail: deal.referralDetail,
      introduced_by_partner_id: deal.introducedById,
      introduced_on: deal.introducedOn,
      started_on: deal.startedOn,
      closed_on: deal.closedOn,
      is_historical: true,
    }
    if (deal.notes) row.notes = deal.notes

    const { error: dealError } = await supabase.from('partner_sales_deals').upsert(row, { onConflict: 'partner_id' })
    if (dealError) { failures.push(`${deal.partnerName}: ${dealError.message}`); continue }

    if (deal.placements.length > 0) {
      const { error: placementError } = await supabase
        .from('partner_apprentice_placements')
        .upsert(deal.placements.map(p => ({
          partner_id: deal.partnerId,
          term: p.term,
          year: p.year,
          count: p.count,
          converted_count: p.convertedCount,
          fee_amount: p.feeAmount,
          fee_status: p.feeStatus,
        })), { onConflict: 'partner_id,term,year' })
      if (placementError) { failures.push(`${deal.partnerName}: deal saved, but placements failed: ${placementError.message}`); continue }
    }
    imported++
  }

  console.log(`\n✅ Imported ${imported} historical deal(s).`)
  if (failures.length > 0) {
    console.log('\nFailures (safe to fix and re-run):')
    failures.forEach(f => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

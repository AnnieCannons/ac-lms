/**
 * Import Student Success outbound referrals from Airtable into Supabase.
 *
 * Reads the "Outbound referrals" Airtable table and creates:
 *   - student_referrals rows (direction: outbound) linked to existing partners
 *   - Ensures the referred-to partner exists in the student_success department
 *
 * Field mapping:
 *   Student (linked → Students table)  → student_identifier (resolved to Preferred Name)
 *   Referral Partner (linked → Referral Partners) → partner_id (via airtable_record_id)
 *   Type of Support                     → referral_type
 *   Date Connected                      → referral_date
 *   Status                              → stored as prefix in outcome_notes
 *   Notes                               → outcome_notes
 *
 * Usage:
 *   npx ts-node --esm scripts/import-student-success-referrals.ts
 *   npx ts-node --esm scripts/import-student-success-referrals.ts --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const BASE_ID          = process.env.AIRTABLE_PARTNERSHIPS_BASE_ID!
const API_KEY          = process.env.AIRTABLE_API_KEY!
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!BASE_ID || !API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars — check .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Airtable helpers ─────────────────────────────────────────────────────────

type AirtableRecord = { id: string; fields: Record<string, unknown> }

async function airtableFetch(table: string, params: URLSearchParams): Promise<{ records: AirtableRecord[]; offset?: string }> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}?${params}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
  if (!res.ok) throw new Error(`Airtable [${table}] ${res.status}: ${await res.text()}`)
  return res.json()
}

async function fetchAll(table: string, fields?: string[]): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const params = new URLSearchParams()
    if (offset) params.set('offset', offset)
    if (fields) fields.forEach(f => params.append('fields[]', f))
    const data = await airtableFetch(table, params)
    all.push(...data.records)
    offset = data.offset
  } while (offset)
  return all
}

// ─── Field parsers ────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null
  return null
}

/** Linked record fields return string[] of record IDs */
function linkedIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

/** Lookup fields return an array — take the first value as a string */
function lookupFirst(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0) return str(v[0])
  return str(v)
}

/** Parse date — Airtable returns ISO "2025-10-24" or display "10/24/2025" */
function parseDate(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

// ─── Main import ──────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '\n── DRY RUN (no writes) ──\n' : '\n── Importing Student Success outbound referrals ──\n')

  // 1. Fetch Outbound referrals from Airtable
  console.log('Fetching "Outbound referrals" from Airtable…')
  const records = await fetchAll('Outbound referrals')
  console.log(`  Found ${records.length} records\n`)

  if (records.length > 0) {
    console.log('Field names in first record:', Object.keys(records[0].fields).join(', '), '\n')
  }

  // 2. Fetch Students table to resolve linked record IDs → Preferred Name
  console.log('Fetching student preferred names…')
  const studentRecords = await fetchAll('Students', ['Preferred Name'])
  const studentNameById: Record<string, string> = {}
  for (const r of studentRecords) {
    const name = str(r.fields['Preferred Name'])
    if (name) studentNameById[r.id] = name
  }
  console.log(`  Resolved ${Object.keys(studentNameById).length} student names\n`)

  // 3. Load all partners from Supabase: airtable_record_id → { id, name }
  console.log('Loading partners from Supabase…')
  const { data: supabasePartners, error: partnerErr } = await supabase
    .from('partners')
    .select('id, name, airtable_record_id')
  if (partnerErr) { console.error('Error loading partners:', partnerErr.message); process.exit(1) }

  const partnerByAirtableId: Record<string, { id: string; name: string }> = {}
  const partnerByName: Record<string, { id: string; name: string }> = {}
  for (const p of supabasePartners ?? []) {
    if (p.airtable_record_id) partnerByAirtableId[p.airtable_record_id] = p
    partnerByName[p.name.toLowerCase().trim()] = p
  }
  console.log(`  Loaded ${supabasePartners?.length ?? 0} partners\n`)

  let created = 0, skipped = 0, errors = 0

  for (const record of records) {
    const f = record.fields

    // ── Resolve student name ────────────────────────────────────────────────
    // Try linked Student record first, fall back to "First Name" lookup
    const studentIds = linkedIds(f['Student'])
    let studentName: string | null = null
    for (const sid of studentIds) {
      if (studentNameById[sid]) { studentName = studentNameById[sid]; break }
    }
    if (!studentName) studentName = lookupFirst(f['First Name (from Student)'] ?? f['First Name'])

    if (!studentName) {
      console.warn(`  Skipping record ${record.id} — could not resolve student name`)
      skipped++
      continue
    }

    // ── Resolve partner ─────────────────────────────────────────────────────
    const partnerIds = linkedIds(f['Referral Partner'])
    let partner: { id: string; name: string } | null = null
    for (const pid of partnerIds) {
      if (partnerByAirtableId[pid]) { partner = partnerByAirtableId[pid]; break }
    }
    // Fallback: match by name from lookup field
    if (!partner) {
      const partnerNameLookup = lookupFirst(f['Referral Partner'])
      if (partnerNameLookup) partner = partnerByName[partnerNameLookup.toLowerCase().trim()] ?? null
    }

    if (!partner) {
      console.warn(`  Skipping record ${record.id} (${studentName}) — could not resolve partner "${JSON.stringify(f['Referral Partner'])}"`)
      skipped++
      continue
    }

    // ── Other fields ────────────────────────────────────────────────────────
    const referralType  = str(f['Type of Support'])
    const referralDate  = parseDate(f['Date Connected']) ?? new Date().toISOString().slice(0, 10)
    const status        = str(f['Status'])
    const notes         = str(f['Notes'])
    const outcomeNotes  = [
      status ? `Status: ${status}` : null,
      notes,
    ].filter(Boolean).join('\n') || null

    if (DRY_RUN) {
      console.log(`${studentName} → ${partner.name}`)
      console.log(`  type=${referralType ?? '—'}  date=${referralDate}  status=${status ?? '—'}`)
      console.log(`  notes=${notes ?? '—'}`)
      console.log()
      continue
    }

    try {
      // Idempotent: check if this referral already exists
      const { data: existing } = await supabase
        .from('student_referrals')
        .select('id')
        .eq('student_identifier', studentName)
        .eq('partner_id', partner.id)
        .eq('direction', 'outbound')
        .maybeSingle()

      if (existing) {
        // Update in case type/date/notes changed
        await supabase
          .from('student_referrals')
          .update({ referral_type: referralType, referral_date: referralDate, outcome_notes: outcomeNotes })
          .eq('id', existing.id)
        console.log(`  ↻ Updated: ${studentName} → ${partner.name}`)
      } else {
        const { error: insertErr } = await supabase
          .from('student_referrals')
          .insert({
            student_identifier: studentName,
            direction: 'outbound',
            partner_id: partner.id,
            referral_date: referralDate,
            referral_type: referralType,
            outcome_notes: outcomeNotes,
          })
        if (insertErr) {
          console.error(`  ERROR inserting ${studentName} → ${partner.name}:`, insertErr.message)
          errors++
          continue
        }
        console.log(`  ✓ ${studentName} → ${partner.name}`)
      }

      // Ensure the partner is enrolled in student_success department
      await supabase
        .from('partner_department_status')
        .upsert(
          { partner_id: partner.id, department: 'student_success', stage: 'Active' },
          { onConflict: 'partner_id,department', ignoreDuplicates: true }
        )

      created++
    } catch (err) {
      console.error(`  ERROR processing ${studentName}:`, err)
      errors++
    }
  }

  console.log(`\n── Done ──`)
  console.log(`  Created/updated: ${created}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Errors: ${errors}`)
}

run().catch(err => { console.error(err); process.exit(1) })

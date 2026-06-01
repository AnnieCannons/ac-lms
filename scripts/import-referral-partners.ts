/**
 * Import Referral Partners from Airtable into Supabase.
 *
 * Reads the "Referral Partners" Airtable table and creates:
 *   - partners rows (type: admissions_referral, dept: admissions)
 *   - partner_contacts rows (Main Contact + Email)
 *   - partner_type_assignments rows
 *   - partner_department_status rows (admissions; resourcefull if onboarded)
 *   - student_referrals rows (direction: inbound, one per linked student)
 *   - admissions_applications rows (airtable_record_id only — no PII)
 *
 * Usage:
 *   npx ts-node --esm scripts/import-referral-partners.ts
 *
 * Add --dry-run to preview without writing to Supabase.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const BASE_ID  = process.env.AIRTABLE_PARTNERSHIPS_BASE_ID!
const API_KEY  = process.env.AIRTABLE_API_KEY!
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!BASE_ID || !API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars. Make sure AIRTABLE_PARTNERSHIPS_BASE_ID is set in .env.local')
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

function bool(v: unknown): boolean {
  return v === true
}

/** Linked record fields return string[] of record IDs */
function linkedIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

/**
 * "State" in Airtable can be a single-select string like "New York" or "Nationwide".
 * Returns { state, multi_city }.
 */
function parseState(v: unknown): { state: string | null; multi_city: boolean } {
  const s = str(v)
  if (!s) return { state: null, multi_city: false }
  if (s.toLowerCase() === 'nationwide') return { state: null, multi_city: true }
  return { state: s, multi_city: false }
}

/**
 * Main Contact can be a text field with comma-separated names, or a linked field.
 * Returns an array of name strings.
 */
function parseContactNames(v: unknown): string[] {
  if (Array.isArray(v)) {
    // Linked record IDs — we can't resolve names without extra fetches; skip for now
    return []
  }
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map(n => n.trim()).filter(Boolean)
  }
  return []
}

// ─── Main import ──────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '\n── DRY RUN (no writes) ──\n' : '\n── Importing referral partners ──\n')

  // 1. Fetch all referral partner records from Airtable
  console.log('Fetching Referral Partners from Airtable…')
  const records = await fetchAll('Referral Partners')
  console.log(`  Found ${records.length} records\n`)

  // 2. Build a map of student Airtable record ID → preferred name
  //    so we can resolve linked student records to readable identifiers
  console.log('Fetching student preferred names from Airtable…')
  const studentRecords = await fetchAll('Students', ['Preferred Name'])
  const studentNameById: Record<string, string> = {}
  for (const r of studentRecords) {
    const name = str(r.fields['Preferred Name'])
    if (name) studentNameById[r.id] = name
  }
  console.log(`  Resolved ${Object.keys(studentNameById).length} student names\n`)

  let created = 0, skipped = 0, errors = 0

  for (const record of records) {
    const f = record.fields
    const name = str(f['Name'])
    if (!name) { console.warn(`  Skipping record ${record.id} — no Name`); skipped++; continue }

    const { state, multi_city } = parseState(f['State'])
    const referralType = str(f['Referral Type'])
    const onlyInbound = bool(f['Only Inbound Referrals'] ?? f['Only Inbound'])
    const resourcefullOnboarded = bool(f['ResourceFull Onboarded Org'])
    const notes = str(f['Notes'])
    const email = str(f['Email'])
    const contactNames = parseContactNames(f['Main Contact'])
    const linkedStudentIds = linkedIds(f['Students'])
    const linkedAppIds = linkedIds(f['Admissions/Applications'])

    console.log(`Processing: ${name}`)
    if (DRY_RUN) {
      console.log(`  state=${state ?? 'null'} multi_city=${multi_city} only_inbound=${onlyInbound}`)
      console.log(`  contacts: ${contactNames.join(', ') || '(none)'} email: ${email ?? '(none)'}`)
      console.log(`  students: ${linkedStudentIds.length}, applications: ${linkedAppIds.length}`)
      console.log(`  resourcefull_onboarded: ${resourcefullOnboarded}`)
      console.log()
      continue
    }

    try {
      // ── Insert or update partner (manual check to avoid partial-index upsert issue) ──
      const { data: existing } = await supabase
        .from('partners')
        .select('id')
        .eq('airtable_record_id', record.id)
        .maybeSingle()

      let partnerId: string

      if (existing) {
        const { error: updateErr } = await supabase
          .from('partners')
          .update({ name, state, multi_city, only_inbound: onlyInbound, services_focus_area: referralType, meeting_notes: notes })
          .eq('id', existing.id)
        if (updateErr) {
          console.error(`  ERROR updating partner "${name}":`, updateErr.message)
          errors++
          continue
        }
        partnerId = existing.id
      } else {
        const { data: partner, error: insertErr } = await supabase
          .from('partners')
          .insert({ name, state, multi_city, status: 'active', only_inbound: onlyInbound, services_focus_area: referralType, meeting_notes: notes, airtable_record_id: record.id })
          .select('id')
          .single()
        if (insertErr || !partner) {
          console.error(`  ERROR creating partner "${name}":`, insertErr?.message)
          errors++
          continue
        }
        partnerId = partner.id
      }

      // ── Partner type: admissions_referral ───────────────────────────────────
      await supabase
        .from('partner_type_assignments')
        .upsert({ partner_id: partnerId, partner_type: 'admissions_referral' }, { onConflict: 'partner_id,partner_type' })

      // ── Department: admissions ──────────────────────────────────────────────
      await supabase
        .from('partner_department_status')
        .upsert({ partner_id: partnerId, department: 'admissions', stage: 'Active Referral Partner' }, { onConflict: 'partner_id,department' })

      // ── Department: resourcefull (if onboarded) ─────────────────────────────
      if (resourcefullOnboarded) {
        await supabase
          .from('partner_type_assignments')
          .upsert({ partner_id: partnerId, partner_type: 'service_provider' }, { onConflict: 'partner_id,partner_type' })
        await supabase
          .from('partner_department_status')
          .upsert({ partner_id: partnerId, department: 'resourcefull', stage: 'Signed Up' }, { onConflict: 'partner_id,department' })
      }

      // ── Contacts ────────────────────────────────────────────────────────────
      if (contactNames.length > 0) {
        // Remove existing contacts first to avoid duplicates on re-run
        await supabase.from('partner_contacts').delete().eq('partner_id', partnerId)

        const contacts = contactNames.map((name, i) => ({
          partner_id: partnerId,
          name,
          title: null,
          email: i === 0 ? email : null, // assign email to first contact
          phone: null,
          is_primary: i === 0,
          notes: null,
        }))
        await supabase.from('partner_contacts').insert(contacts)
      } else if (email) {
        // No named contact but we have an email — create a placeholder
        await supabase.from('partner_contacts').delete().eq('partner_id', partnerId)
        await supabase.from('partner_contacts').insert({
          partner_id: partnerId,
          name: name, // org name as fallback
          email,
          is_primary: true,
        })
      }

      // ── Student referrals (inbound: org referred students to AC) ────────────
      for (const studentRecordId of linkedStudentIds) {
        const preferredName = studentNameById[studentRecordId]
        if (!preferredName) {
          console.warn(`    Could not resolve student record ${studentRecordId} — skipping`)
          continue
        }

        // Check if this referral already exists to keep the script idempotent
        const { data: existingReferral } = await supabase
          .from('student_referrals')
          .select('id')
          .eq('student_identifier', preferredName)
          .eq('partner_id', partnerId)
          .eq('direction', 'inbound')
          .maybeSingle()

        if (!existingReferral) {
          const { error: refErr } = await supabase
            .from('student_referrals')
            .insert({
              student_identifier: preferredName,
              direction: 'inbound',
              partner_id: partnerId,
              referral_date: new Date().toISOString().slice(0, 10),
              referral_type: referralType,
            })
          if (refErr) console.warn(`    Could not insert referral for ${preferredName}:`, refErr.message)
        }
      }

      // ── Admissions applications (store Airtable record ID only) ────────────
      for (const appRecordId of linkedAppIds) {
        await supabase
          .from('admissions_applications')
          .upsert({ partner_id: partnerId, airtable_record_id: appRecordId }, { onConflict: 'airtable_record_id' })
      }

      console.log(`  ✓ ${name} (${linkedStudentIds.length} students, ${linkedAppIds.length} applications)`)
      created++

    } catch (err) {
      console.error(`  ERROR processing "${name}":`, err)
      errors++
    }
  }

  console.log(`\n── Done ──`)
  console.log(`  Created/updated: ${created}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Errors: ${errors}`)
}

run().catch(err => { console.error(err); process.exit(1) })

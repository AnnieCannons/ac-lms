/**
 * Import ResourceFull organizations from a Google Sheets CSV export into Supabase.
 *
 * For each row:
 *   - Creates or updates a partner (name, status, state, locations_served, website)
 *   - Creates partner_contacts (handles multiple contacts separated by newlines)
 *   - Upserts partner_department_status for resourcefull with stage + metadata
 *
 * Field mapping:
 *   Organization            → partners.name
 *   Status                  → partners.status (mapped) + partner_department_status.stage (raw)
 *   Contact Name            → partner_contacts.name (split on newline)
 *   Contact Email           → partner_contacts.email (split on newline)
 *   Website                 → partners.website
 *   Location/Locations Served → partners.locations_served (raw) + state="California"
 *   Program Name            → partner_department_status.metadata.program_name
 *   Main Phone              → partner_department_status.metadata.phone
 *   Hotline                 → partner_department_status.metadata.hotline
 *   Public Address          → partner_department_status.metadata.public_address
 *   Some virtual programs   → partner_department_status.metadata.virtual_programs
 *   Includes faith-based    → partner_department_status.metadata.faith_based
 *   Eligibility             → partner_department_status.metadata.eligibility
 *
 * Usage:
 *   npx ts-node --esm scripts/import-resourcefull-csv.ts path/to/file.csv
 *   npx ts-node --esm scripts/import-resourcefull-csv.ts path/to/file.csv --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars — check .env.local')
  process.exit(1)
}

const csvPath = process.argv.find(a => a.endsWith('.csv'))
if (!csvPath) {
  console.error('Usage: npx ts-node --esm scripts/import-resourcefull-csv.ts <path-to-csv> [--dry-run]')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Status mapping ───────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  'seeking contact':              'prospect',
  'coordinating/in conversation': 'prospect',
  'invited to join':              'in_onboarding',
  'invited to rejoin':            'in_onboarding',
  'sign up in progress':          'in_onboarding',
  'onboarded':                    'active',
  'going mia':                    'inactive',
}

function mapStatus(raw: string): string {
  return STATUS_MAP[raw.toLowerCase().trim()] ?? 'prospect'
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  // Normalise line endings
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: Record<string, string>[] = []
  let headers: string[] = []
  let inRow = false
  let fields: string[] = []
  let current = ''
  let inQuotes = false
  let isFirstRow = true

  function flushField() { fields.push(current); current = '' }
  function flushRow() {
    flushField()
    if (isFirstRow) {
      headers = fields.map(h => h.trim())
      isFirstRow = false
    } else if (fields.some(f => f.trim())) {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = (fields[i] ?? '').trim() })
      rows.push(row)
    }
    fields = []
    inRow = false
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    inRow = true
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      flushField()
    } else if (ch === '\n' && !inQuotes) {
      flushRow()
    } else {
      current += ch
    }
  }
  if (inRow || current) flushRow()
  return rows
}

// ─── Name normalisation ───────────────────────────────────────────────────────

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/\b(inc|llc|corp|ltd|the|of|and|&)\b/g, '').replace(/\s+/g, ' ').trim()
}

// ─── Multi-line field splitter ────────────────────────────────────────────────

function splitLines(val: string): string[] {
  return val.split(/\n+/).map(s => s.trim()).filter(Boolean)
}

/** Parse "FirstName LastName, Job Title" into { name, title } */
function parseContactName(raw: string): { name: string; title: string | null } {
  const commaIdx = raw.indexOf(',')
  if (commaIdx === -1) return { name: raw.trim(), title: null }
  const before = raw.slice(0, commaIdx).trim()
  const after  = raw.slice(commaIdx + 1).trim()
  // Only split if the part before the comma looks like a person's name
  // (1-4 words, no digits) and the part after is non-empty
  const looksLikeName = /^[A-Za-z\s'\-\.]{2,40}$/.test(before) && before.split(' ').length <= 4
  if (looksLikeName && after) {
    return { name: before, title: after }
  }
  return { name: raw.trim(), title: null }
}

function str(v: string): string | null {
  return v.trim() || null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '\n── DRY RUN (no writes) ──\n' : '\n── Importing ResourceFull orgs ──\n')

  const raw = readFileSync(resolve(process.cwd(), csvPath!), 'utf-8')
  const rows = parseCSV(raw)
  const validRows = rows.filter(r => r['Organization']?.trim())
  console.log(`CSV rows with org names: ${validRows.length}\n`)

  // Load existing Supabase partners for matching
  const { data: existing, error: loadErr } = await supabase
    .from('partners')
    .select('id, name')
  if (loadErr) { console.error('Failed to load partners:', loadErr.message); process.exit(1) }

  const partnerByNorm = new Map<string, { id: string; name: string }>()
  for (const p of existing ?? []) {
    partnerByNorm.set(normalize(p.name), { id: p.id, name: p.name })
  }

  let created = 0, updated = 0, skipped = 0, errors = 0

  for (const row of validRows) {
    const orgName   = row['Organization'].replace(/\s*\n\s*/g, ' ').trim()
    const rawStatus = row['Status']?.trim() ?? ''
    const website   = str(row['Website'] ?? '')
    const location  = str(row['Location/Locations Served'] ?? '')
    const programName   = str(row['Program Name'] ?? '')
    const mainPhone     = str(row['Main Phone'] ?? '')
    const hotline       = str(row['Hotline'] ?? '')
    const publicAddress = str(row['Public Address'] ?? '')
    const virtualPrograms = str(row['Some virtual programs'] ?? '')
    const faithBased    = str(row['Includes faith-based services'] ?? '')
    const eligibility   = str(row['Eligibility'] ?? '')

    const mappedStatus = mapStatus(rawStatus)
    const stage = rawStatus || 'Seeking contact'

    // Contacts: split multi-line name + email fields, pair by index
    const contactNames  = splitLines(row['Contact Name'] ?? '')
    const contactEmails = splitLines(row['Contact Email'] ?? '')

    // Metadata for resourcefull dept
    const metadata: Record<string, string | boolean | null> = {}
    if (programName)    metadata.program_name    = programName
    if (mainPhone)      metadata.phone           = mainPhone
    if (hotline)        metadata.hotline         = hotline
    if (publicAddress)  metadata.public_address  = publicAddress
    if (virtualPrograms) metadata.virtual_programs = virtualPrograms
    if (faithBased)     metadata.faith_based     = faithBased
    if (eligibility)    metadata.eligibility     = eligibility

    if (DRY_RUN) {
      const norm = normalize(orgName)
      const match = partnerByNorm.get(norm)
      const action = match ? `UPDATE (${match.name})` : 'CREATE'
      console.log(`[${action}] ${orgName}`)
      console.log(`  status: ${mappedStatus} (stage: "${stage}")`)
      console.log(`  location: ${location ?? '—'}  website: ${website ?? '—'}`)
      if (contactNames.length) {
        const parsed = contactNames.map(n => {
          const { name, title } = parseContactName(n)
          return title ? `${name} (${title})` : name
        })
        console.log(`  contacts: ${parsed.join(', ')}`)
      }
      if (Object.keys(metadata).length) console.log(`  metadata: ${JSON.stringify(metadata)}`)
      console.log()
      continue
    }

    try {
      const norm = normalize(orgName)
      let partnerId: string
      const existingPartner = partnerByNorm.get(norm)

      if (existingPartner) {
        // Update existing partner
        const { error: updateErr } = await supabase
          .from('partners')
          .update({
            status: mappedStatus,
            ...(website ? { website } : {}),
            ...(location ? { locations_served: location } : {}),
            state: 'California',
          })
          .eq('id', existingPartner.id)
        if (updateErr) throw new Error(updateErr.message)
        partnerId = existingPartner.id
        console.log(`  ↻ Updated: ${orgName}`)
        updated++
      } else {
        // Create new partner
        const { data: newPartner, error: insertErr } = await supabase
          .from('partners')
          .insert({
            name: orgName,
            status: mappedStatus,
            state: 'California',
            multi_city: false,
            ...(website ? { website } : {}),
            ...(location ? { locations_served: location } : {}),
          })
          .select('id')
          .single()
        if (insertErr || !newPartner) throw new Error(insertErr?.message ?? 'No id returned')
        partnerId = newPartner.id
        partnerByNorm.set(norm, { id: partnerId, name: orgName })
        console.log(`  ✓ Created: ${orgName}`)
        created++
      }

      // Upsert contacts — only add contacts that don't already exist by name
      const { data: existingContacts } = await supabase
        .from('partner_contacts')
        .select('name')
        .eq('partner_id', partnerId)
      const existingContactNames = new Set((existingContacts ?? []).map(c => c.name.toLowerCase().trim()))

      for (let i = 0; i < contactNames.length; i++) {
        const { name: contactName, title } = parseContactName(contactNames[i])
        const email = contactEmails[i] ?? null
        if (existingContactNames.has(contactName.toLowerCase().trim())) continue
        await supabase.from('partner_contacts').insert({
          partner_id: partnerId,
          name: contactName,
          title: title || null,
          email: email || null,
          is_primary: i === 0 && existingContactNames.size === 0,
        })
      }

      // Upsert resourcefull dept status with metadata
      await supabase
        .from('partner_department_status')
        .upsert(
          {
            partner_id: partnerId,
            department: 'resourcefull',
            stage,
            metadata: Object.keys(metadata).length > 0 ? metadata : null,
          },
          { onConflict: 'partner_id,department' }
        )

    } catch (err) {
      console.error(`  ERROR processing "${orgName}":`, err instanceof Error ? err.message : err)
      errors++
    }
  }

  if (!DRY_RUN) {
    console.log('\n── Done ──')
    console.log(`  Created: ${created}`)
    console.log(`  Updated: ${updated}`)
    console.log(`  Skipped: ${skipped}`)
    console.log(`  Errors:  ${errors}`)
  }
}

run().catch(err => { console.error(err); process.exit(1) })

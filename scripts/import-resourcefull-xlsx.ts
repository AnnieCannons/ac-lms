/**
 * Import ResourceFull organizations from a multi-sheet Excel file into Supabase.
 *
 * Reads all partner sheets from the xlsx, skipping already-imported SF sheet,
 * Group Outreach, and Recommenders (different formats).
 *
 * Each sheet's name is used to infer the state when Location field is empty.
 *
 * Usage:
 *   npx ts-node --esm scripts/import-resourcefull-xlsx.ts path/to/file.xlsx
 *   npx ts-node --esm scripts/import-resourcefull-xlsx.ts path/to/file.xlsx --dry-run
 *   npx ts-node --esm scripts/import-resourcefull-xlsx.ts path/to/file.xlsx --sheet "New York CityNew York"
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx') as typeof import('xlsx')

const DRY_RUN    = process.argv.includes('--dry-run')
const sheetArg   = process.argv.find((_, i, a) => a[i - 1] === '--sheet')
const xlsxPath   = process.argv.find(a => a.endsWith('.xlsx') || a.endsWith('.xls'))

if (!xlsxPath) {
  console.error('Usage: npx ts-node --esm scripts/import-resourcefull-xlsx.ts <file.xlsx> [--dry-run] [--sheet "Sheet Name"]')
  process.exit(1)
}

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars — check .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Sheets to skip ───────────────────────────────────────────────────────────

const SKIP_SHEETS = new Set([
  'San Francisco Bay AreaCaliforni', // already imported
  'Group Outreach',                   // different format
  'Recommenders',                     // different format
])

// ─── Sheet name → state ───────────────────────────────────────────────────────

const SHEET_STATE: Record<string, string | null> = {
  'New York CityNew York':  'New York',
  'VirtualNational':        'Nationwide',
  'Atlanta, GA':            'Georgia',
  'Los AngelesSouthern CA': 'California',
  'Seattle, WA':            'Washington',
  'Washington DC':          'Washington, DC',
  'Las Vegas, NV':          'Nevada',
  'Tennesee':               'Tennessee',
  'Other':                  null,
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}

function normalize(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/\b(inc|llc|corp|ltd|the|of|and|&)\b/g, '').replace(/\s+/g, ' ').trim()
}

function splitLines(val: unknown): string[] {
  if (!val) return []
  return String(val).split(/[\n\r]+/).map(s => s.trim()).filter(Boolean)
}

function parseContactName(raw: string): { name: string; title: string | null } {
  const commaIdx = raw.indexOf(',')
  if (commaIdx === -1) return { name: raw.trim(), title: null }
  const before = raw.slice(0, commaIdx).trim()
  const after  = raw.slice(commaIdx + 1).trim()
  const looksLikeName = /^[A-Za-z\s'\-\.]{2,40}$/.test(before) && before.split(' ').length <= 4
  if (looksLikeName && after) return { name: before, title: after }
  return { name: raw.trim(), title: null }
}

interface ParsedContactEntry {
  name: string
  email: string | null
  website_url: string | null
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}(?=[^a-zA-Z]|$)/g
const URL_RE   = /https?:\/\/[^\s\)\"\'<>]+/g

// Parses a Contact Email cell → one entry per email or form URL found.
// Extracts labels (text before ":") as contact names where available.
function parseEmailCell(raw: string | null): ParsedContactEntry[] {
  if (!raw) return []
  const results: ParsedContactEntry[] = []
  const lines = raw.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    const emails = [...line.matchAll(new RegExp(EMAIL_RE.source, 'g'))].map(m => m[0])
    const urls   = [...line.matchAll(new RegExp(URL_RE.source, 'g'))]
      .map(m => m[0])
      .filter(u => !u.includes('@'))

    // Short label before ":" (skip if it looks like a URL prefix)
    let label: string | null = null
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0 && colonIdx <= 50) {
      const candidate = line.slice(0, colonIdx).trim()
      if (!/^https?$/i.test(candidate) && candidate.length > 1) label = candidate
    }

    if (emails.length > 0) {
      for (const email of emails) {
        results.push({ name: label ?? 'General', email, website_url: urls[0] ?? null })
      }
    } else if (urls.length > 0) {
      results.push({ name: label ?? 'General', email: null, website_url: urls[0] })
    }
  }

  // Deduplicate by email (lowercased), then by website_url
  const seenEmails = new Set<string>()
  const seenUrls   = new Set<string>()
  return results.filter(r => {
    if (r.email) {
      const key = r.email.toLowerCase()
      if (seenEmails.has(key)) return false
      seenEmails.add(key)
      return true
    }
    if (r.website_url) {
      const key = r.website_url.toLowerCase()
      if (seenUrls.has(key)) return false
      seenUrls.add(key)
      return true
    }
    return false
  })
}

// ─── Process one sheet ────────────────────────────────────────────────────────

async function processSheet(
  sheetName: string,
  rows: Record<string, unknown>[],
  partnerByNorm: Map<string, { id: string; name: string }>,
  inferredState: string | null
) {
  const validRows = rows.filter(r => str(r['Organization']))
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Sheet: "${sheetName}"  (${validRows.length} orgs, inferred state: ${inferredState ?? 'none'})`)
  console.log('─'.repeat(60))

  let created = 0, updated = 0, errors = 0

  for (const row of validRows) {
    const orgName     = str(row['Organization'])!.replace(/\s*\n\s*/g, ' ').trim()
    const rawStatus   = str(row['Status']) ?? ''
    const website     = str(row['Website'])
    const location    = str(row['Location/Locations Served'])
    const programName = str(row['Program Name'])
    const mainPhone   = str(row['Main Phone'])
    const hotline     = str(row['Hotline'])
    const publicAddr  = str(row['Public Address'])
    const virtual     = str(row['Some virtual programs'])
    const faithBased  = str(row['Includes faith-based services'])
    const eligibility = str(row['Eligibility'])

    // LA sheet has an extra "Service Type" column — fold into metadata
    const serviceType = str(row['Service Type'])

    const mappedStatus = mapStatus(rawStatus)
    const stage        = rawStatus || 'Seeking contact'

    const contactNames = splitLines(row['Contact Name'])

    const metadata: Record<string, string | null> = {}
    if (programName)  metadata.program_name   = programName
    if (mainPhone)    metadata.phone          = mainPhone
    if (hotline)      metadata.hotline        = hotline
    if (publicAddr)   metadata.public_address = publicAddr
    if (virtual)      metadata.virtual_programs = virtual
    if (faithBased)   metadata.faith_based    = faithBased
    if (eligibility)  metadata.eligibility    = eligibility
    if (serviceType)  metadata.service_type   = serviceType

    // State: use inferred sheet state; "Nationwide" sheet → multi_city=true, state=null
    const state     = inferredState === 'Nationwide' ? null : inferredState
    const multiCity = inferredState === 'Nationwide'

    if (DRY_RUN) {
      const norm  = normalize(orgName)
      const match = partnerByNorm.get(norm)
      const action = match ? `UPDATE (${match.name})` : 'CREATE'
      console.log(`[${action}] ${orgName}`)
      console.log(`  status: ${mappedStatus} | state: ${state ?? 'none'} | nationwide: ${multiCity}`)
      const rawEmailCell = str(row['Contact Email'])
      const parsed = parseEmailCell(rawEmailCell)
      if (contactNames.length) console.log(`  named contacts: ${contactNames.join(', ')}`)
      if (parsed.length) {
        for (const p of parsed) {
          const parts = [p.name, p.email ?? '—', p.website_url ? `[URL: ${p.website_url}]` : ''].filter(Boolean)
          console.log(`  contact: ${parts.join(' | ')}`)
        }
      }
      console.log()
      continue
    }

    try {
      const norm = normalize(orgName)
      let partnerId: string
      const existing = partnerByNorm.get(norm)

      if (existing) {
        const { error: updateErr } = await supabase
          .from('partners')
          .update({
            status: mappedStatus,
            ...(website  ? { website }  : {}),
            ...(location ? { locations_served: location } : {}),
            ...(state !== undefined ? { state } : {}),
            multi_city: multiCity,
          })
          .eq('id', existing.id)
        if (updateErr) throw new Error(updateErr.message)
        partnerId = existing.id
        console.log(`  ↻ Updated: ${orgName}`)
        updated++
      } else {
        const { data: newPartner, error: insertErr } = await supabase
          .from('partners')
          .insert({
            name: orgName,
            status: mappedStatus,
            state,
            multi_city: multiCity,
            ...(website  ? { website }  : {}),
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

      // Contacts: build from named contacts (paired by index) + parse email cell for the rest
      const rawEmailCell = str(row['Contact Email'])
      const parsedFromCell = parseEmailCell(rawEmailCell)

      // Named contacts use the Contact Name column; override names from parsed entries
      const namedEntries: ParsedContactEntry[] = contactNames.map((rawName, i) => {
        const { name: cName, title: _title } = parseContactName(rawName)
        const fromCell = parsedFromCell[i]
        return {
          name: cName,
          email: fromCell?.email ?? null,
          website_url: fromCell?.website_url ?? null,
          _title,
        } as ParsedContactEntry & { _title: string | null }
      })

      const namedEmails = new Set(namedEntries.map(e => e.email?.toLowerCase()).filter(Boolean) as string[])

      // Add any parsed entries not already covered by a named contact
      const extraEntries = parsedFromCell.filter(e =>
        !e.email || !namedEmails.has(e.email.toLowerCase())
      )

      const allNewContacts: (ParsedContactEntry & { _title?: string | null })[] = [
        ...namedEntries,
        ...extraEntries,
      ]

      const { data: existingContacts } = await supabase
        .from('partner_contacts').select('email, website_url').eq('partner_id', partnerId)
      const existingEmails = new Set((existingContacts ?? []).map(c => c.email?.toLowerCase()).filter(Boolean) as string[])
      const existingUrls   = new Set((existingContacts ?? []).map(c => c.website_url?.toLowerCase()).filter(Boolean) as string[])

      for (let i = 0; i < allNewContacts.length; i++) {
        const c = allNewContacts[i]
        if (c.email && existingEmails.has(c.email.toLowerCase())) continue
        if (!c.email && c.website_url && existingUrls.has(c.website_url.toLowerCase())) continue
        await supabase.from('partner_contacts').insert({
          partner_id: partnerId,
          name: c.name,
          title: (c as { _title?: string | null })._title ?? null,
          email: c.email || null,
          website_url: c.website_url || null,
          is_primary: i === 0 && (existingContacts?.length ?? 0) === 0,
        })
        if (c.email) existingEmails.add(c.email.toLowerCase())
        if (!c.email && c.website_url) existingUrls.add(c.website_url.toLowerCase())
      }

      // Resourcefull dept status
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

      // Partner type: service_provider
      await supabase
        .from('partner_type_assignments')
        .upsert({ partner_id: partnerId, partner_type: 'service_provider' }, { onConflict: 'partner_id,partner_type' })

    } catch (err) {
      console.error(`  ERROR processing "${orgName}":`, err instanceof Error ? err.message : err)
      errors++
    }
  }

  if (!DRY_RUN) {
    console.log(`  → Created: ${created}  Updated: ${updated}  Errors: ${errors}`)
  }

  return { created, updated, errors }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '\n── DRY RUN (no writes) ──\n' : '\n── Importing ResourceFull xlsx ──\n')

  const wb = XLSX.readFile(resolve(process.cwd(), xlsxPath!))
  console.log(`Sheets in file: ${wb.SheetNames.join(', ')}\n`)

  // Load existing partners once for dedup
  const { data: existingPartners, error: loadErr } = await supabase
    .from('partners').select('id, name')
  if (loadErr) { console.error('Failed to load partners:', loadErr.message); process.exit(1) }

  const partnerByNorm = new Map<string, { id: string; name: string }>()
  for (const p of existingPartners ?? []) {
    partnerByNorm.set(normalize(p.name), { id: p.id, name: p.name })
  }
  console.log(`Loaded ${partnerByNorm.size} existing partners for dedup\n`)

  const sheetsToProcess = sheetArg
    ? [sheetArg]
    : wb.SheetNames.filter(n => !SKIP_SHEETS.has(n))

  let totalCreated = 0, totalUpdated = 0, totalErrors = 0

  for (const sheetName of sheetsToProcess) {
    if (SKIP_SHEETS.has(sheetName)) {
      console.log(`\nSkipping sheet: "${sheetName}"`)
      continue
    }
    const sheet = wb.Sheets[sheetName]
    if (!sheet) { console.warn(`Sheet "${sheetName}" not found`); continue }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    const inferredState = SHEET_STATE[sheetName] ?? null

    const { created, updated, errors } = await processSheet(sheetName, rows, partnerByNorm, inferredState)
    totalCreated += created
    totalUpdated += updated
    totalErrors  += errors
  }

  if (!DRY_RUN) {
    console.log('\n══════════════════════════════════════')
    console.log('TOTAL')
    console.log(`  Created: ${totalCreated}`)
    console.log(`  Updated: ${totalUpdated}`)
    console.log(`  Errors:  ${totalErrors}`)
    console.log('══════════════════════════════════════')
  }
}

run().catch(err => { console.error(err); process.exit(1) })

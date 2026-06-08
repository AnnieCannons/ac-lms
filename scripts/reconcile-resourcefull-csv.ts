/**
 * Reconcile a ResourceFull CSV export against existing Supabase partners.
 *
 * Usage:
 *   npx ts-node --esm scripts/reconcile-resourcefull-csv.ts path/to/resourcefull.csv
 *
 * Outputs three sections:
 *   ✓ MATCHED  — org name found in both (exact or fuzzy)
 *   + NEW       — in CSV but not in Supabase (would be created)
 *   ~ SUPABASE ONLY — in Supabase resourcefull dept but not in CSV
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars — check .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: npx ts-node --esm scripts/reconcile-resourcefull-csv.ts <path-to-csv>')
  process.exit(1)
}

// ─── CSV parser (no dependencies) ─────────────────────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  // Parse header row
  const headers = parseCSVLine(lines[0])

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ─── Name normalisation for fuzzy matching ─────────────────────────────────────

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(inc|llc|corp|ltd|the|of|and|&)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  // 1. Load CSV
  const raw = readFileSync(resolve(process.cwd(), csvPath), 'utf-8')
  const rows = parseCSV(raw)
  console.log(`\nCSV: ${rows.length} rows`)
  if (rows.length > 0) {
    console.log('Columns detected:', Object.keys(rows[0]).join(' | '), '\n')
  }

  // Filter out rows with no org name
  const csvOrgs = rows
    .map(r => ({
      name: r['Organization'] ?? r['organization'] ?? r['Org'] ?? r['org'] ?? '',
      status: r['Status'] ?? '',
      contact: r['Contact Name'] ?? '',
      email: r['Contact Email'] ?? '',
      location: r['Location/Locations Served'] ?? r['Location'] ?? r['Locations Served'] ?? '',
      website: r['Website'] ?? '',
      phone: r['Main Phone'] ?? '',
      program: r['Program Name'] ?? '',
    }))
    .filter(o => o.name.trim())

  console.log(`CSV orgs with names: ${csvOrgs.length}`)

  // 2. Load all Supabase partners
  const { data: partners, error } = await supabase
    .from('partners')
    .select('id, name, partner_department_status(department)')
  if (error) { console.error('Supabase error:', error.message); process.exit(1) }

  const allPartners = partners ?? []
  const resourcefullPartners = allPartners.filter(p =>
    (p.partner_department_status as { department: string }[]).some(d => d.department === 'resourcefull')
  )

  console.log(`Supabase: ${allPartners.length} total partners, ${resourcefullPartners.length} in resourcefull dept\n`)

  // Build normalized lookup maps
  const supabaseByNorm = new Map<string, { id: string; name: string }>()
  for (const p of allPartners) {
    supabaseByNorm.set(normalize(p.name), { id: p.id, name: p.name })
  }

  // 3. Reconcile
  const matched: { csv: string; supabase: string; inResourcefull: boolean }[] = []
  const newOrgs: typeof csvOrgs = []
  const matchedSupabaseIds = new Set<string>()

  for (const org of csvOrgs) {
    const normCsv = normalize(org.name)
    const found = supabaseByNorm.get(normCsv)
    if (found) {
      const inDept = resourcefullPartners.some(p => p.id === found.id)
      matched.push({ csv: org.name, supabase: found.name, inResourcefull: inDept })
      matchedSupabaseIds.add(found.id)
    } else {
      // Try partial match (CSV name contains Supabase name or vice versa)
      let partialMatch: { id: string; name: string } | null = null
      for (const [norm, p] of supabaseByNorm.entries()) {
        if (normCsv.includes(norm) || norm.includes(normCsv)) {
          partialMatch = p
          break
        }
      }
      if (partialMatch) {
        const inDept = resourcefullPartners.some(p => p.id === partialMatch!.id)
        matched.push({ csv: org.name, supabase: `≈ ${partialMatch.name}`, inResourcefull: inDept })
        matchedSupabaseIds.add(partialMatch.id)
      } else {
        newOrgs.push(org)
      }
    }
  }

  const supabaseOnly = resourcefullPartners.filter(p => !matchedSupabaseIds.has(p.id))

  // 4. Report
  console.log(`${'─'.repeat(60)}`)
  console.log(`✓ MATCHED (${matched.length}) — exist in both`)
  console.log(`${'─'.repeat(60)}`)
  for (const m of matched.sort((a, b) => a.csv.localeCompare(b.csv))) {
    const deptTag = m.inResourcefull ? '[resourcefull]' : '[other dept]'
    const nameNote = m.supabase.startsWith('≈') ? `  →  ${m.supabase}` : (m.csv !== m.supabase ? `  →  "${m.supabase}"` : '')
    console.log(`  ${m.csv}${nameNote}  ${deptTag}`)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`+ NEW (${newOrgs.length}) — in CSV but not in Supabase`)
  console.log(`${'─'.repeat(60)}`)
  for (const o of newOrgs.sort((a, b) => a.name.localeCompare(b.name))) {
    const parts = [o.location, o.contact, o.status].filter(Boolean).join(' · ')
    console.log(`  ${o.name}${parts ? `  (${parts})` : ''}`)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`~ SUPABASE ONLY (${supabaseOnly.length}) — resourcefull partners not in CSV`)
  console.log(`${'─'.repeat(60)}`)
  for (const p of supabaseOnly.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${p.name}`)
  }

  console.log(`\n── Summary ──`)
  console.log(`  CSV orgs:         ${csvOrgs.length}`)
  console.log(`  Matched:          ${matched.length}`)
  console.log(`  New (to import):  ${newOrgs.length}`)
  console.log(`  Supabase only:    ${supabaseOnly.length}`)
}

run().catch(err => { console.error(err); process.exit(1) })

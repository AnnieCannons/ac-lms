/**
 * Find and merge duplicate partners in Supabase.
 *
 * Usage:
 *   # List all suspected duplicates
 *   npx ts-node --esm scripts/dedup-partners.ts
 *
 *   # Merge two partners — keeps KEEP_ID, moves all data from DELETE_ID, then deletes DELETE_ID
 *   npx ts-node --esm scripts/dedup-partners.ts --merge <keep-id> <delete-id>
 *
 *   # Dry-run a merge (shows what would happen, no writes)
 *   npx ts-node --esm scripts/dedup-partners.ts --merge <keep-id> <delete-id> --dry-run
 *
 * When merging, the following child records are re-pointed to KEEP_ID:
 *   partner_contacts, partner_type_assignments, partner_department_status,
 *   partner_interactions, student_referrals
 * Then DELETE_ID partner row is deleted.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('Missing env vars'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const mergeIdx = process.argv.indexOf('--merge')
const MERGE_MODE = mergeIdx !== -1
const KEEP_ID   = MERGE_MODE ? process.argv[mergeIdx + 1] : null
const DELETE_ID = MERGE_MODE ? process.argv[mergeIdx + 2] : null

// ─── Normalisation ─────────────────────────────────────────────────────────────

/** Collapse to lowercase letters+digits only — catches spacing/punctuation diffs */
function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Simple Levenshtein for catching 1-2 char typos */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

// ─── List duplicates ───────────────────────────────────────────────────────────

async function listDuplicates() {
  const { data: partners, error } = await supabase
    .from('partners')
    .select('id, name, city, state, status, partner_department_status(department)')
    .order('name')
  if (error) { console.error(error.message); process.exit(1) }

  const all = partners ?? []
  const seen = new Map<string, typeof all>()  // normalised key → partners[]

  // Group by collapsed key (exact after stripping spaces/punctuation)
  for (const p of all) {
    const k = key(p.name)
    if (!seen.has(k)) seen.set(k, [])
    seen.get(k)!.push(p)
  }

  // Also find near-matches via Levenshtein on the collapsed key
  const keys = [...seen.keys()]
  const fuzzyGroups: Set<string>[] = []
  const usedKeys = new Set<string>()

  for (let i = 0; i < keys.length; i++) {
    if (usedKeys.has(keys[i])) continue
    const group = new Set([keys[i]])
    for (let j = i + 1; j < keys.length; j++) {
      if (usedKeys.has(keys[j])) continue
      // Only compare keys of similar length
      const lenDiff = Math.abs(keys[i].length - keys[j].length)
      if (lenDiff > 4) continue
      if (levenshtein(keys[i], keys[j]) <= 2) {
        group.add(keys[j])
        usedKeys.add(keys[j])
      }
    }
    if (group.size > 1 || (seen.get(keys[i])?.length ?? 0) > 1) {
      fuzzyGroups.push(group)
    }
    usedKeys.add(keys[i])
  }

  const dupGroups: (typeof all)[] = []
  for (const group of fuzzyGroups) {
    const members = [...group].flatMap(k => seen.get(k) ?? [])
    if (members.length > 1) dupGroups.push(members)
  }

  if (dupGroups.length === 0) {
    console.log('No duplicates found 🎉')
    return
  }

  console.log(`\nFound ${dupGroups.length} suspected duplicate group${dupGroups.length !== 1 ? 's' : ''}:\n`)

  for (const group of dupGroups) {
    console.log('─'.repeat(60))
    for (const p of group) {
      const depts = (p.partner_department_status as { department: string }[])
        .map(d => d.department).join(', ') || '—'
      const loc = [p.city, p.state].filter(Boolean).join(', ') || '—'
      console.log(`  ${p.name}`)
      console.log(`    id:     ${p.id}`)
      console.log(`    status: ${p.status}  location: ${loc}  depts: ${depts}`)
    }
    console.log()
  }

  console.log('To merge, run:')
  console.log('  npx ts-node --esm scripts/dedup-partners.ts --merge <keep-id> <delete-id> --dry-run')
}

// ─── Merge two partners ────────────────────────────────────────────────────────

async function mergePartners(keepId: string, deleteId: string) {
  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Merging: DELETE ${deleteId} → KEEP ${keepId}\n`)

  // Load both partners
  const { data: keepPartner } = await supabase.from('partners').select('id, name').eq('id', keepId).single()
  const { data: delPartner }  = await supabase.from('partners').select('id, name').eq('id', deleteId).single()

  if (!keepPartner) { console.error(`Keep partner ${keepId} not found`); process.exit(1) }
  if (!delPartner)  { console.error(`Delete partner ${deleteId} not found`); process.exit(1) }

  console.log(`  Keeping:  "${keepPartner.name}" (${keepId})`)
  console.log(`  Deleting: "${delPartner.name}" (${deleteId})\n`)

  // Tables with unique constraints on (partner_id, X) — need to delete dupes before moving
  const UNIQUE_TABLES: { table: string; uniqueCol: string }[] = [
    { table: 'partner_type_assignments', uniqueCol: 'partner_type' },
    { table: 'partner_department_status', uniqueCol: 'department' },
  ]

  for (const { table, uniqueCol } of UNIQUE_TABLES) {
    const { data: delRows } = await supabase.from(table).select(`id, ${uniqueCol}`).eq('partner_id', deleteId)
    const { data: keepRows } = await supabase.from(table).select(uniqueCol).eq('partner_id', keepId)
    if (!delRows?.length) { console.log(`  ${table}: nothing to move`); continue }

    const keepVals = new Set((keepRows ?? []).map((r: Record<string, string>) => r[uniqueCol]))
    const toDelete = delRows.filter((r: Record<string, string>) => keepVals.has(r[uniqueCol]))
    const toMove   = delRows.filter((r: Record<string, string>) => !keepVals.has(r[uniqueCol]))

    console.log(`  ${table}: moving ${toMove.length}, dropping ${toDelete.length} (already on kept partner)`)
    if (!DRY_RUN) {
      if (toDelete.length) {
        await supabase.from(table).delete().in('id', toDelete.map((r: Record<string, string>) => r.id))
      }
      if (toMove.length) {
        const { error } = await supabase.from(table).update({ partner_id: keepId }).eq('partner_id', deleteId)
        if (error) console.error(`    ERROR: ${error.message}`)
      }
    }
  }

  // Simple tables — just re-point partner_id
  const SIMPLE_TABLES = ['partner_contacts', 'partner_interactions', 'student_referrals']
  for (const table of SIMPLE_TABLES) {
    const { data: rows } = await supabase.from(table).select('id').eq('partner_id', deleteId)
    const count = rows?.length ?? 0
    if (count === 0) { console.log(`  ${table}: nothing to move`); continue }
    console.log(`  ${table}: moving ${count} row${count !== 1 ? 's' : ''}`)
    if (!DRY_RUN) {
      const { error } = await supabase.from(table).update({ partner_id: keepId }).eq('partner_id', deleteId)
      if (error) console.error(`    ERROR: ${error.message}`)
    }
  }

  // Delete the duplicate partner row
  console.log(`\n  Deleting partner row "${delPartner.name}"`)
  if (!DRY_RUN) {
    const { error } = await supabase.from('partners').delete().eq('id', deleteId)
    if (error) { console.error(`  ERROR deleting partner: ${error.message}`); process.exit(1) }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Done — no changes made' : '✓ Merge complete'}`)
}

// ─── Entry point ───────────────────────────────────────────────────────────────

async function run() {
  if (MERGE_MODE) {
    if (!KEEP_ID || !DELETE_ID) {
      console.error('Usage: --merge <keep-id> <delete-id>')
      process.exit(1)
    }
    await mergePartners(KEEP_ID, DELETE_ID)
  } else {
    await listDuplicates()
  }
}

run().catch(err => { console.error(err); process.exit(1) })

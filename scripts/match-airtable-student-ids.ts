/**
 * Matches LMS students (users.name, role=student) to their Airtable "Students"
 * record, and backfills users.airtable_student_id (e.g. "S121") so that future
 * lookups don't have to rely on preferred-name matching, which breaks once two
 * students pick the same display name.
 *
 * Matching is tried in two passes:
 *   1. By "Student Email" (unambiguous — always preferred when populated). Going
 *      forward, fill this in on the Airtable record when a new student is added
 *      and this script will pick them up automatically, no manual review needed.
 *   2. By preferred name, for the existing backlog of records without an email.
 *
 * The Airtable student code lives in the record's "Name" field, formatted like
 * "S121 - ZanettaR" (code + concatenated first-name/last-initial). On some records
 * that code ended up typed into "Preferred Name" instead, with "Name" left blank —
 * those are reported separately as low-confidence and never auto-applied.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/match-airtable-student-ids.ts          # dry run (default)
 *   source .env.local && npx ts-node --esm scripts/match-airtable-student-ids.ts --apply   # writes confident matches
 */
import { createClient } from '@supabase/supabase-js'
import { EXCLUDED_STUDENT_USER_IDS } from '../src/lib/excluded-students.ts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const APPLY = process.argv.includes('--apply')

type AirtableRecord = { id: string; fields: Record<string, unknown> }

async function airtablePaginate(table: string): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const p = new URLSearchParams()
    if (offset) p.set('offset', offset)
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error(`Airtable [${table}] ${res.status}: ${await res.text()}`)
    const data = await res.json()
    all.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)
  return all
}

const CODE_RE = /^S(\d+)\s*-\s*(.*)$/i
// Heuristic split for concatenated "FirstNameL" -> "FirstName" + "L" (last initial)
const CONCAT_RE = /^([A-Z][a-z]+)([A-Z])$/

type ParsedRecord = {
  recordId: string
  code: string
  preferredName: string | null
  guessedName: string | null
  anomaly: boolean
  courses: string
  email: string | null
}

function courseSummary(fields: Record<string, unknown>, courseNames: Map<string, string>): string {
  const resolve = (ids: string[]) => ids.map(id => courseNames.get(id) ?? id).join(', ')
  const current = fields['Current Course'] as string[] | undefined
  const past = fields['Past Courses'] as string[] | undefined
  const parts: string[] = []
  if (current?.length) parts.push(`current: ${resolve(current)}`)
  if (past?.length) parts.push(`past: ${resolve(past)}`)
  return parts.length ? parts.join(' | ') : 'no course on record'
}

function parseRecord(r: AirtableRecord, courseNames: Map<string, string>): ParsedRecord | null {
  const name = ((r.fields['Name'] as string) ?? '').trim()
  const pref = ((r.fields['Preferred Name'] as string) ?? '').trim()
  const courses = courseSummary(r.fields, courseNames)
  const email = ((r.fields['Student Email'] as string) ?? '').trim().toLowerCase() || null

  const nameMatch = name.match(CODE_RE)
  if (nameMatch) {
    return {
      recordId: r.id,
      code: `S${nameMatch[1]}`,
      preferredName: pref || null,
      guessedName: null,
      anomaly: false,
      courses,
      email,
    }
  }

  const prefMatch = pref.match(CODE_RE)
  if (prefMatch) {
    const suffix = prefMatch[2]
    const concatMatch = suffix.match(CONCAT_RE)
    return {
      recordId: r.id,
      code: `S${prefMatch[1]}`,
      preferredName: null,
      guessedName: concatMatch ? concatMatch[1] : suffix || null,
      anomaly: true,
      courses,
      email,
    }
  }

  return null // blank/test row, e.g. "TEST - Catie" or fully empty
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will write to Supabase)' : 'DRY RUN (no writes)'}\n`)

  console.log('Fetching Airtable Courses…')
  const courseRecords = await airtablePaginate('Courses')
  const courseNames = new Map(courseRecords.map(r => [r.id, (r.fields['Name'] as string) ?? r.id]))

  console.log('Fetching Airtable Students…')
  const airtableRecords = await airtablePaginate('Students')
  const parsed = airtableRecords
    .map(r => parseRecord(r, courseNames))
    .filter((p): p is ParsedRecord => p !== null)
  const skipped = airtableRecords.length - parsed.length
  console.log(`  ${airtableRecords.length} total, ${parsed.length} with a usable code, ${skipped} skipped (blank/test rows)\n`)

  console.log('Fetching LMS students…')
  const { data: lmsUsersRaw, error } = await supabase
    .from('users')
    .select('id, name, email, airtable_student_id')
    .eq('role', 'student')
  if (error) throw new Error(`Supabase error: ${error.message}`)
  console.log(`  ${lmsUsersRaw?.length ?? 0} LMS students\n`)

  const excludedCount = (lmsUsersRaw ?? []).filter(u => EXCLUDED_STUDENT_USER_IDS.has(u.id)).length
  if (excludedCount) {
    console.log(`  ${excludedCount} test/inactive account(s) excluded — no Airtable match expected\n`)
  }
  const lmsUsers = (lmsUsersRaw ?? []).filter(u => !EXCLUDED_STUDENT_USER_IDS.has(u.id))

  const alreadySet = lmsUsers.filter(u => u.airtable_student_id)
  if (alreadySet.length) {
    console.log(`  ${alreadySet.length} already have airtable_student_id set — leaving those untouched\n`)
  }
  const allCandidates = lmsUsers.filter(u => !u.airtable_student_id)

  // Codes already claimed by someone else must never be offered as a fresh match —
  // otherwise a leftover same-named student can appear to "confidently" match a
  // code that's actually already assigned (only the UNIQUE constraint would catch it).
  const usedCodes = new Set(alreadySet.map(u => u.airtable_student_id).filter(Boolean))
  const parsedAvailable = parsed.filter(p => !usedCodes.has(p.code))
  const claimedElsewhere = parsed.length - parsedAvailable.length
  if (claimedElsewhere) {
    console.log(`  ${claimedElsewhere} Airtable record(s) skipped — code already claimed by a different student\n`)
  }

  // Pass 1: match by "Student Email" — unambiguous whenever it's populated.
  // This is the path new students should go through going forward.
  const confidentMatches: { userId: string; userName: string; code: string; via: 'email' | 'name' }[] = []
  const emailMatchedUserIds = new Set<string>()
  const withEmail = parsedAvailable.filter(p => p.email)
  const lmsByEmail = new Map((allCandidates ?? []).map(u => [u.email?.toLowerCase(), u]))
  for (const p of withEmail) {
    const match = lmsByEmail.get(p.email!)
    if (match && !emailMatchedUserIds.has(match.id)) {
      confidentMatches.push({ userId: match.id, userName: match.name, code: p.code, via: 'email' })
      emailMatchedUserIds.add(match.id)
    }
  }
  if (confidentMatches.length) {
    console.log(`✉️  Matched by Student Email: ${confidentMatches.length}\n`)
  }

  const candidates = allCandidates.filter(u => !emailMatchedUserIds.has(u.id))
  const parsedRemaining = parsedAvailable.filter(p => !p.email)

  // Group LMS candidates by lowercase name
  const lmsByName = new Map<string, typeof candidates>()
  for (const u of candidates) {
    if (!u.name) continue
    const key = u.name.trim().toLowerCase()
    lmsByName.set(key, [...(lmsByName.get(key) ?? []), u])
  }

  const normal = parsedRemaining.filter(p => !p.anomaly && p.preferredName)
  const anomalies = parsedRemaining.filter(p => p.anomaly)
  const noName = parsedRemaining.filter(p => !p.anomaly && !p.preferredName)

  // Group normal Airtable records by lowercase preferred name (detect Airtable-side dupes too)
  const airtableByName = new Map<string, ParsedRecord[]>()
  for (const p of normal) {
    const key = p.preferredName!.trim().toLowerCase()
    airtableByName.set(key, [...(airtableByName.get(key) ?? []), p])
  }

  const collisions: string[] = []
  const noLmsMatch: string[] = []

  for (const [nameKey, rawRecords] of airtableByName) {
    // Collapse duplicate Airtable rows that resolve to the same code (e.g. a
    // leftover blank enrollment row alongside the real one) — same code, not a collision.
    const byCode = new Map<string, ParsedRecord>()
    for (const r of rawRecords) if (!byCode.has(r.code)) byCode.set(r.code, r)
    const records = [...byCode.values()]

    const lmsMatches = lmsByName.get(nameKey) ?? []
    if (records.length === 1 && lmsMatches.length === 1) {
      confidentMatches.push({ userId: lmsMatches[0].id, userName: lmsMatches[0].name, code: records[0].code, via: 'name' })
    } else if (lmsMatches.length === 0) {
      noLmsMatch.push(`  "${records.map(r => r.preferredName).join('" / "')}" (${records.map(r => r.code).join(', ')}) — no LMS student with this name`)
    } else {
      const airtableSide = records.map(r => `${r.code} (${r.courses})`).join(' | ')
      const lmsSide = lmsMatches.map(u => `${u.name} <${u.email}>`).join(', ')
      collisions.push(`  "${nameKey}"\n    Airtable: ${airtableSide}\n    LMS: ${lmsSide}`)
    }
  }

  console.log(`✅ Confident matches (unambiguous on both sides): ${confidentMatches.length}`)
  for (const m of confidentMatches) console.log(`  ${m.userName} -> ${m.code}`)

  console.log(`\n⚠️  Collisions needing manual resolution: ${collisions.length}`)
  collisions.forEach(c => console.log(c))

  const matchedUserIds = new Set(confidentMatches.map(m => m.userId))
  const stillUnmatched = candidates.filter(u => !matchedUserIds.has(u.id))
  console.log(`\n📋 LMS students still without an airtable_student_id after this pass: ${stillUnmatched.length}`)
  stillUnmatched.forEach(u => console.log(`  ${u.name} <${u.email}>`))

  console.log(`\nℹ️  Anomalies (code was typed into Preferred Name, real name unknown): ${anomalies.length}`)
  for (const a of anomalies) {
    const guess = a.guessedName
    const nameHints = guess ? (lmsByName.get(guess.toLowerCase()) ?? []) : []
    // Fall back to matching the guessed name against the email local-part, for
    // students whose current LMS display name no longer resembles it at all.
    const emailHints = guess
      ? candidates.filter(
          u => !nameHints.includes(u) && u.email?.toLowerCase().includes(guess.toLowerCase()),
        )
      : []
    const nameStr = nameHints.map(u => `${u.name} <${u.email}>`).join(', ')
    const emailStr = emailHints.map(u => `${u.name} <${u.email}>`).join(', ')
    const parts: string[] = []
    if (nameStr) parts.push(`name match: ${nameStr}`)
    if (emailStr) parts.push(`email match: ${emailStr}`)
    console.log(`  ${a.code} — guessed name "${guess ?? '?'}"${parts.length ? ` — ${parts.join(' | ')}` : ' — no hint found'}`)
  }

  if (noLmsMatch.length) {
    console.log(`\nℹ️  Airtable students with no LMS account match (likely alumni/inactive): ${noLmsMatch.length}`)
    noLmsMatch.forEach(n => console.log(n))
  }

  if (noName.length) {
    console.log(`\nℹ️  Airtable records with a code but no preferred name at all: ${noName.length}`)
    noName.forEach(n => console.log(`  ${n.code}`))
  }

  if (APPLY) {
    console.log(`\nWriting ${confidentMatches.length} confident matches…`)
    for (const m of confidentMatches) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ airtable_student_id: m.code })
        .eq('id', m.userId)
      if (updateError) console.error(`  FAILED for ${m.userName}: ${updateError.message}`)
    }
    console.log('Done.')
  } else {
    console.log('\nDry run only — re-run with --apply to write the confident matches above.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })

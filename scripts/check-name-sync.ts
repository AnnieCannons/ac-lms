/**
 * Compares student names in the LMS (Supabase users.name, role=student)
 * against Preferred Names in the Airtable Students table.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/check-name-sync.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!

async function airtablePaginate(table: string, params: URLSearchParams): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const all: { id: string; fields: Record<string, unknown> }[] = []
  let offset: string | undefined

  do {
    const p = new URLSearchParams(params)
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

async function main() {
  console.log('Fetching LMS students from Supabase…')
  const { data: lmsUsers, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'student')

  if (error) throw new Error(`Supabase error: ${error.message}`)

  const lmsNames = (lmsUsers ?? [])
    .map(u => u.name as string)
    .filter(Boolean)
    .map(n => n.trim())

  console.log(`  Found ${lmsNames.length} students in LMS\n`)

  console.log('Fetching Airtable student names…')
  const airtableRecords = await airtablePaginate('Students', new URLSearchParams())
  const airtableNames = airtableRecords
    .map(r => r.fields['Preferred Name'] as string)
    .filter(Boolean)
    .map(n => n.trim())

  console.log(`  Found ${airtableNames.length} students in Airtable\n`)

  const airtableSet = new Set(airtableNames.map(n => n.toLowerCase()))
  const lmsSet = new Set(lmsNames.map(n => n.toLowerCase()))

  const notInAirtable = lmsNames.filter(n => !airtableSet.has(n.toLowerCase()))
  const notInLms = airtableNames.filter(n => !lmsSet.has(n.toLowerCase()))

  if (notInAirtable.length === 0) {
    console.log('✅ All LMS students have a matching Airtable entry.')
  } else {
    console.log(`⚠️  ${notInAirtable.length} LMS student(s) NOT found in Airtable:`)
    notInAirtable.forEach(n => console.log(`   - "${n}"`))
  }

  console.log()

  if (notInLms.length === 0) {
    console.log('✅ All Airtable students have a matching LMS entry.')
  } else {
    console.log(`ℹ️  ${notInLms.length} Airtable student(s) NOT found in LMS (may be alumni or inactive):`)
    notInLms.forEach(n => console.log(`   - "${n}"`))
  }
}

main().catch(e => { console.error(e); process.exit(1) })

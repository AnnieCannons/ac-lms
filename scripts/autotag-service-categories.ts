/**
 * Auto-tag partners with service_categories AND detect state from free-text fields.
 *
 * Reads: services_focus_area, meeting_notes, and resourcefull dept metadata
 * (program_name, eligibility, public_address, locations_served).
 *
 * - service_categories: adds detected categories, never removes existing ones
 * - state: only sets if currently null/empty; detects from full state names or
 *   "City, ST" / "ST XXXXX" zip patterns in the text
 *
 * Usage:
 *   npx ts-node --esm scripts/autotag-service-categories.ts --dry-run
 *   npx ts-node --esm scripts/autotag-service-categories.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

type ServiceCategory =
  | 'Childcare / Family Support' | 'Domestic Violence Services' | 'Financial Assistance'
  | 'Financial Literacy' | 'Food / Basic Needs' | 'Healthcare' | 'Housing'
  | 'Immigration Services' | 'Job Training / Employment' | 'Legal Aid'
  | 'Mental Health / Counseling' | 'Substance Use Recovery' | 'Youth Services'

const CATEGORY_KEYWORDS: Record<ServiceCategory, string[]> = {
  'Housing': ['housing', 'shelter', 'homeless', 'transitional housing', 'home', 'rapid rehousing', 'affordable housing', 'eviction', 'residential', 'housing program', 'housing options'],
  'Childcare / Family Support': ['childcare', 'child care', 'family', 'parenting', 'children', 'foster', 'kids', 'parent', 'reunification', 'family services', 'family support'],
  'Mental Health / Counseling': ['mental health', 'counseling', 'counselling', 'therapy', 'therapist', 'psychological', 'trauma', 'behavioral health', 'wellness', 'psychiatric', 'ptsd'],
  'Legal Aid': ['legal', 'attorney', 'lawyer', 'law ', 'justice', 'court', 'rights', 'legal aid', 'legal services', 'public defender', 'criminal record', 'expungement'],
  'Job Training / Employment': ['job', 'employment', 'workforce', 'career', 'training', 'vocational', 'work readiness', 'apprenticeship', 'internship', 'job placement', 'job training', 'economic empowerment'],
  'Substance Use Recovery': ['substance', 'recovery', 'addiction', 'alcohol', 'drug', 'sobriety', 'rehab', 'detox', 'substance use', 'substance abuse', 'clean slate'],
  'Domestic Violence Services': ['domestic violence', ' dv ', 'abuse', 'survivor', 'intimate partner', 'safety planning', 'battered', 'violence against', 'sexual assault', 'sexual violence', 'trafficking', 'exploitation', 'human trafficking'],
  'Youth Services': ['youth', 'young adult', 'teen', 'adolescent', 'tay', 'transitional age youth', 'age 16', 'age 18', 'age 24', 'young people', 'foster youth'],
  'Immigration Services': ['immigration', 'immigrant', 'undocumented', 'visa', 'citizenship', 'refugee', 'asylum', 'daca', 'deportation'],
  'Food / Basic Needs': ['food', 'nutrition', 'basic needs', 'food pantry', 'meals', 'hunger', 'groceries', 'clothing', 'hygiene', 'supplies', 'diaper'],
  'Healthcare': ['health', 'medical', 'clinic', 'hospital', 'primary care', 'healthcare', 'calim', 'medi-cal', 'medicaid', 'reproductive', 'dental', 'vision'],
  'Financial Assistance': ['financial assistance', 'benefits', 'cash assistance', 'emergency funds', 'rental assistance', 'utility', 'stipend', 'compensation'],
  'Financial Literacy': ['financial literacy', 'financial education', 'budgeting', 'credit', 'money management', 'banking', 'savings', 'debt', 'financial skills', 'financial coaching'],
}

const DRY_RUN = process.argv.includes('--dry-run')
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('Missing env vars'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── State detection ──────────────────────────────────────────────────────────

const STATE_NAMES: [string, string][] = [
  ['Alabama','AL'],['Alaska','AK'],['Arizona','AZ'],['Arkansas','AR'],['California','CA'],
  ['Colorado','CO'],['Connecticut','CT'],['Delaware','DE'],['Florida','FL'],['Georgia','GA'],
  ['Hawaii','HI'],['Idaho','ID'],['Illinois','IL'],['Indiana','IN'],['Iowa','IA'],
  ['Kansas','KS'],['Kentucky','KY'],['Louisiana','LA'],['Maine','ME'],['Maryland','MD'],
  ['Massachusetts','MA'],['Michigan','MI'],['Minnesota','MN'],['Mississippi','MS'],['Missouri','MO'],
  ['Montana','MT'],['Nebraska','NE'],['Nevada','NV'],['New Hampshire','NH'],['New Jersey','NJ'],
  ['New Mexico','NM'],['New York','NY'],['North Carolina','NC'],['North Dakota','ND'],['Ohio','OH'],
  ['Oklahoma','OK'],['Oregon','OR'],['Pennsylvania','PA'],['Rhode Island','RI'],['South Carolina','SC'],
  ['South Dakota','SD'],['Tennessee','TN'],['Texas','TX'],['Utah','UT'],['Vermont','VT'],
  ['Virginia','VA'],['Washington','WA'],['West Virginia','WV'],['Wisconsin','WI'],['Wyoming','WY'],
  ['District of Columbia','DC'],
]

// Zip code → state prefix map (first digit(s))
const ZIP_STATE: [RegExp, string][] = [
  [/\bCA\s+9[0-6]\d{3}\b/i, 'California'],
  [/\bNY\s+1[0-4]\d{3}\b/i, 'New York'],
  [/\bTX\s+[67]\d{4}\b/i, 'Texas'],
  [/\bWA\s+9[8-9]\d{3}\b/i, 'Washington'],
  [/\bOR\s+97\d{3}\b/i, 'Oregon'],
  [/\bGA\s+3[0-1]\d{3}\b/i, 'Georgia'],
  [/\bIL\s+6[0-2]\d{3}\b/i, 'Illinois'],
  [/\bMD\s+2[0-2]\d{3}\b/i, 'Maryland'],
  [/\bVA\s+2[0-4]\d{3}\b/i, 'Virginia'],
  [/\bFL\s+3[2-4]\d{3}\b/i, 'Florida'],
]

function detectState(text: string): string | null {
  // 1. Full state name (case-insensitive word boundary)
  for (const [name] of STATE_NAMES) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name
  }
  // 2. "City, ST" pattern — e.g. "Oakland, CA"
  const cityStateMatch = text.match(/,\s*([A-Z]{2})\b/)
  if (cityStateMatch) {
    const abbr = cityStateMatch[1].toUpperCase()
    const found = STATE_NAMES.find(([, a]) => a === abbr)
    if (found) return found[0]
  }
  // 3. "ST XXXXX" zip code pattern — e.g. "CA 94601"
  for (const [re, name] of ZIP_STATE) {
    if (re.test(text)) return name
  }
  return null
}

function detectCategories(text: string): ServiceCategory[] {
  const lower = text.toLowerCase()
  return (Object.entries(CATEGORY_KEYWORDS) as [ServiceCategory, string[]][])
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([cat]) => cat)
}

async function run() {
  console.log(DRY_RUN ? '\n── DRY RUN ──\n' : '\n── Auto-tagging service categories ──\n')

  // Load all partners with relevant text fields + existing categories + state
  const { data: partners, error } = await supabase
    .from('partners')
    .select('id, name, state, locations_served, services_focus_area, meeting_notes, service_categories')
  if (error) { console.error(error.message); process.exit(1) }

  // Load resourcefull dept metadata for all partners
  const { data: deptRows } = await supabase
    .from('partner_department_status')
    .select('partner_id, metadata')
    .eq('department', 'resourcefull')

  const metaByPartnerId: Record<string, Record<string, string>> = {}
  for (const row of deptRows ?? []) {
    if (row.metadata) metaByPartnerId[row.partner_id] = row.metadata
  }

  let tagged = 0, stateUpdated = 0, skipped = 0

  for (const partner of partners ?? []) {
    const meta = metaByPartnerId[partner.id] ?? {}
    const combinedText = [
      partner.services_focus_area,
      partner.meeting_notes,
      partner.locations_served,
      meta.program_name,
      meta.eligibility,
      meta.public_address,
    ].filter(Boolean).join(' ')

    const updates: Record<string, unknown> = {}
    const logLines: string[] = []

    // ── Service categories ────────────────────────────────────────────────────
    if (combinedText.trim()) {
      const detected = detectCategories(combinedText)
      const existing = (partner.service_categories as string[]) ?? []
      const merged = [...new Set([...existing, ...detected])]
      const newTags = merged.filter(c => !existing.includes(c))
      if (newTags.length > 0) {
        updates.service_categories = merged
        logLines.push(`  + services: ${newTags.join(', ')}`)
        tagged++
      }
    }

    // ── State detection (only if currently unset) ─────────────────────────────
    if (!partner.state && combinedText.trim()) {
      const detectedState = detectState(combinedText)
      if (detectedState) {
        updates.state = detectedState
        logLines.push(`  + state: ${detectedState}`)
        stateUpdated++
      }
    }

    if (logLines.length === 0) { skipped++; continue }

    console.log(partner.name)
    logLines.forEach(l => console.log(l))
    console.log()

    if (!DRY_RUN) {
      const { error: updateErr } = await supabase
        .from('partners')
        .update(updates)
        .eq('id', partner.id)
      if (updateErr) console.error(`  ERROR: ${updateErr.message}`)
    }
  }

  console.log(`── Done ──`)
  console.log(`  Service categories tagged: ${tagged}`)
  console.log(`  States detected:           ${stateUpdated}`)
  console.log(`  No changes:                ${skipped}`)
}

run().catch(err => { console.error(err); process.exit(1) })

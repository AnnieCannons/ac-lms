/**
 * Import Funding Partners from .md files in scripts/data/funding-partners/
 *
 * Each .md file represents one contact person at a corporate partner org.
 * The script:
 *   - Creates a partner record per unique Company
 *   - Creates a partner_type_assignment: corporate
 *   - Creates a partner_department_status row: funding_partnerships
 *   - Creates a partner_contact row for the named person
 *   - Creates a partner_interaction with the body text as the note
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/import-funding-partners.ts
 *   Add --dry-run to preview without writing to Supabase.
 */

import { config } from 'dotenv'
import { resolve, join } from 'path'
import { readFileSync, readdirSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const DATA_DIR = join(process.cwd(), 'scripts/data/funding-partners')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmail(raw: string): { email: string | null; linkedinUrl: string | null } {
  // Handle formats: plain email, "Name" <email@example.com>, Name <email@example.com>
  const angleMatch = raw.match(/<([^>]+@[^>]+)>/)
  if (angleMatch) return { email: angleMatch[1].trim(), linkedinUrl: null }
  // LinkedIn URL stored in the Email field
  if (raw.includes('linkedin.com')) return { email: null, linkedinUrl: raw.trim() }
  // Other URL — skip
  if (raw.startsWith('http')) return { email: null, linkedinUrl: null }
  const plain = raw.trim()
  if (plain.includes('@')) return { email: plain, linkedinUrl: null }
  return { email: null, linkedinUrl: null }
}

function parseDate(raw: string): string | null {
  // "May 18, 2026" or "October 14, 2025" → "2026-05-18"
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseNeedsOutreach(raw: string): string | null {
  // "1. Yes" → "yes", "2. Discuss" → "waiting", "3. Waiting" → "waiting", "4. No" → "no"
  const normalized = raw.toLowerCase()
  if (normalized.includes('yes')) return 'yes'
  if (normalized.includes('no')) return 'no'
  if (normalized.includes('waiting')) return 'waiting'
  if (normalized.includes('discuss')) return 'discuss'
  return null
}

interface ParsedContact {
  contactName: string
  company: string | null
  email: string | null
  linkedinUrl: string | null
  accountOwner: string | null
  lastContact: string | null
  needsOutreach: string | null
  bodyNote: string
}

function parseMd(filePath: string): ParsedContact {
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  // h1 = contact name
  const h1Line = lines.find(l => l.startsWith('# '))
  const contactName = h1Line ? h1Line.replace(/^#\s+/, '').trim() : 'Unknown'

  // Parse key: value lines from frontmatter block (lines after h1 until blank or body)
  const fields: Record<string, string> = {}
  let bodyStart = 0
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^([A-Za-z ]+):\s*(.*)$/)
    if (match) {
      fields[match[1].trim()] = match[2].trim()
    } else if (lines[i].trim() === '' && i > 2 && bodyStart === 0) {
      // First blank line after frontmatter = body starts on next non-empty line
      bodyStart = i + 1
    }
  }

  // Body = everything after the first blank line following the frontmatter fields
  // Skip lines that look like frontmatter (key: value) to avoid including them
  const bodyLines: string[] = []
  let pastFrontmatter = false
  for (let i = 1; i < lines.length; i++) {
    const isFrontmatter = /^[A-Za-z ]+:\s/.test(lines[i]) && !pastFrontmatter
    if (!isFrontmatter && lines[i].trim() !== '' && !pastFrontmatter) {
      // If we've hit a non-frontmatter non-blank line, we're in the body
      pastFrontmatter = true
    }
    if (pastFrontmatter) {
      bodyLines.push(lines[i])
    }
  }
  // Trim leading/trailing blank lines from body
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') bodyLines.shift()
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop()

  // Strip trailing emoji/status markers from company names (e.g. "F5  🟢")
  const cleanCompany = (s: string) => s.replace(/[\s\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u, '').trim()

  const { email, linkedinUrl } = fields['Email'] ? extractEmail(fields['Email']) : { email: null, linkedinUrl: null }

  return {
    contactName,
    company: fields['Company'] ? cleanCompany(fields['Company']) : null,
    email,
    linkedinUrl,
    accountOwner: fields['Account Owner'] || null,
    lastContact: fields['Last Contact'] ? parseDate(fields['Last Contact']) : null,
    needsOutreach: fields['Need Outreach'] ? parseNeedsOutreach(fields['Need Outreach']) : null,
    bodyNote: bodyLines.join('\n').trim(),
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes' : '🚀 Importing funding partners...')

  // Load all .md files
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.md'))
  console.log(`Found ${files.length} .md files`)

  const parsed = files.map(f => parseMd(join(DATA_DIR, f)))

  // Look up Laura Hackney (and any other account owners) by name
  const ownerNames = [...new Set(parsed.map(p => p.accountOwner).filter(Boolean))]
  const { data: staffRows } = await supabase
    .from('users')
    .select('id, name')
    .in('name', ownerNames as string[])
  const ownerMap: Record<string, string> = {}
  for (const u of staffRows ?? []) ownerMap[u.name] = u.id

  // Also try partial match for "Laura" in case full name doesn't match exactly
  if (ownerNames.some(n => n?.startsWith('Laura')) && !ownerMap['Laura Hackney']) {
    const { data: lauraRows } = await supabase
      .from('users')
      .select('id, name')
      .ilike('name', '%Laura%')
    for (const u of lauraRows ?? []) {
      ownerMap['Laura Hackney'] = u.id
      console.log(`  Matched "Laura Hackney" → "${u.name}" (${u.id})`)
      break
    }
  }

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const p of parsed) {
    const company = p.company ?? p.contactName
    console.log(`\n→ ${company} (contact: ${p.contactName})`)

    if (DRY_RUN) {
      console.log(`   company=${company}, email=${p.email}, linkedin=${p.linkedinUrl}, outreach=${p.needsOutreach}, lastContact=${p.lastContact}`)
      continue
    }

    // Upsert partner by name (case-insensitive check first)
    const { data: existing } = await supabase
      .from('partners')
      .select('id')
      .ilike('name', company)
      .limit(1)
      .single()

    let partnerId: string

    if (existing?.id) {
      partnerId = existing.id
      console.log(`   ↩ found existing partner ${partnerId}`)
    } else {
      const ownerId = p.accountOwner ? ownerMap[p.accountOwner] ?? null : null
      const { data: newPartner, error: partnerErr } = await supabase
        .from('partners')
        .insert({
          name: company,
          status: 'prospect',
          last_interaction_date: p.lastContact,
          internal_owner_id: ownerId,
          tags: [],
          multi_city: false,
        })
        .select('id')
        .single()

      if (partnerErr || !newPartner) {
        errors.push(`${company}: ${partnerErr?.message}`)
        console.error(`   ✗ failed to create partner: ${partnerErr?.message}`)
        skipped++
        continue
      }
      partnerId = newPartner.id
      console.log(`   ✓ created partner ${partnerId}`)
      created++
    }

    // partner_type_assignment: corporate
    await supabase
      .from('partner_type_assignments')
      .upsert({ partner_id: partnerId, partner_type: 'corporate' }, { onConflict: 'partner_id,partner_type' })

    // partner_department_status: funding_partnerships
    const ownerId = p.accountOwner ? ownerMap[p.accountOwner] ?? null : null
    await supabase
      .from('partner_department_status')
      .upsert(
        {
          partner_id: partnerId,
          department: 'funding_partnerships',
          stage: '',
          needs_outreach: p.needsOutreach,
          updated_by: ownerId,
        },
        { onConflict: 'partner_id,department' }
      )

    // partner_contact — upsert so re-running the script fills in missing emails
    if (p.contactName) {
      const { data: existingContact } = await supabase
        .from('partner_contacts')
        .select('id')
        .eq('partner_id', partnerId)
        .ilike('name', p.contactName)
        .limit(1)
        .maybeSingle()

      if (existingContact?.id) {
        const { error: updateErr } = await supabase
          .from('partner_contacts')
          .update({ email: p.email, linkedin_url: p.linkedinUrl })
          .eq('id', existingContact.id)
        if (updateErr) console.error(`   ✗ contact update failed: ${updateErr.message}`)
        else console.log(`   ↩ updated existing contact (email=${p.email}, linkedin=${p.linkedinUrl})`)
      } else {
        const { error: insertErr } = await supabase.from('partner_contacts').insert({
          partner_id: partnerId,
          name: p.contactName,
          email: p.email,
          linkedin_url: p.linkedinUrl,
          is_primary: true,
          is_archived: false,
        })
        if (insertErr) console.error(`   ✗ contact insert failed: ${insertErr.message}`)
        else console.log(`   ✓ created contact (email=${p.email}, linkedin=${p.linkedinUrl})`)
      }
    }

    // Interaction note from body text
    if (p.bodyNote) {
      const { data: staffUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', ownerId ?? '')
        .single()

      await supabase.from('partner_interactions').insert({
        partner_id: partnerId,
        note: p.bodyNote,
        interaction_date: p.lastContact ?? new Date().toISOString().slice(0, 10),
        department: 'funding_partnerships',
        user_id: staffUser?.id ?? null,
      })
    }
  }

  console.log(`\n✅ Done. Created: ${created}, Skipped: ${skipped}`)
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log('  ✗', e))
  }
}

main().catch(console.error)

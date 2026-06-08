/**
 * Send 60-day follow-up rating requests to students after outbound referrals.
 * Also sends reminders for referrals where rating_request_sent_at is 7 or 14 days ago
 * and no rating has been submitted yet.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/send-referral-followups.ts
 *   source .env.local && npx ts-node --esm scripts/send-referral-followups.ts --dry-run
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SLACK_BOT_TOKEN      = process.env.SLACK_BOT_TOKEN
const APP_URL              = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
const STAFF_NOTIFY_EMAIL   = process.env.STAFF_NOTIFY_EMAIL   // e.g. robyn@anniecannons.com
const DRY_RUN              = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!APP_URL) {
  console.error('Missing NEXT_PUBLIC_APP_URL')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferralRow {
  id: string
  referral_date: string
  service_category: string | null
  rating_request_sent_at: string | null
  student_user_id: string
  partners: { name: string } | { name: string }[] | null
  users: { name: string; email: string } | { name: string; email: string }[] | null
}

// ─── Slack helpers (inline — script runs outside Next.js, can't import from src/) ──

async function slackLookupByEmail(email: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    )
    const json = (await res.json()) as { ok: boolean; user?: { id: string } }
    return json.ok && json.user ? json.user.id : null
  } catch {
    return null
  }
}

async function slackPostMessage(channel: string, text: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    })
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (!json.ok) console.warn(`  Slack error: ${json.error}`)
    return json.ok
  } catch (e) {
    console.warn('  Slack request failed:', e)
    return false
  }
}

// ─── Staff notification ───────────────────────────────────────────────────────

let _staffSlackId: string | null | undefined = undefined

async function notifyStaff(studentName: string, partnerName: string, serviceCategory: string | null) {
  if (!SLACK_BOT_TOKEN || !STAFF_NOTIFY_EMAIL) return

  if (_staffSlackId === undefined) {
    _staffSlackId = await slackLookupByEmail(STAFF_NOTIFY_EMAIL)
    if (!_staffSlackId) {
      console.warn(`  Could not find Slack user for STAFF_NOTIFY_EMAIL (${STAFF_NOTIFY_EMAIL})`)
    }
  }
  if (!_staffSlackId) return

  const categoryText = serviceCategory ? ` for ${serviceCategory}` : ''
  const text = `${studentName} has received their invitation to rate their referral to ${partnerName}${categoryText}.`

  if (DRY_RUN) {
    console.log(`  [dry-run] Would notify staff: ${text}`)
    return
  }

  const sent = await slackPostMessage(_staffSlackId, text)
  console.log(`  Staff Slack notify: ${sent ? 'sent' : 'FAILED'}`)
}

// ─── Notification helpers ─────────────────────────────────────────────────────

function getPartnerName(referral: ReferralRow): string {
  if (!referral.partners) return 'an organization'
  const p = Array.isArray(referral.partners) ? referral.partners[0] : referral.partners
  return p?.name ?? 'an organization'
}

function getStudentInfo(referral: ReferralRow): { name: string; email: string } | null {
  if (!referral.users) return null
  const u = Array.isArray(referral.users) ? referral.users[0] : referral.users
  return u ?? null
}

async function sendNotification(
  referral: ReferralRow,
  type: 'initial' | 'reminder7' | 'reminder14'
) {
  const student = getStudentInfo(referral)
  if (!student) {
    console.warn(`  No student info for referral ${referral.id} — skipping`)
    return
  }

  const partnerName = getPartnerName(referral)
  const ratingUrl = `${APP_URL}/student/referrals/rate/${referral.id}`
  const categoryText = referral.service_category ? ` for ${referral.service_category}` : ''

  const messagePrefix = type === 'initial'
    ? `Hi ${student.name}! We referred you to ${partnerName}${categoryText} about 60 days ago.`
    : `Hi ${student.name}! Just a reminder — we'd love your feedback on your referral to ${partnerName}${categoryText}.`

  const slackMessage = `${messagePrefix} If you connected with them, we'd love to hear how it went: ${ratingUrl}`
  const emailBody = `${messagePrefix}\n\nIf you had a chance to connect with them, please take a moment to share your experience:\n${ratingUrl}\n\nThank you!`

  console.log(`  Email to ${student.email}:`)
  console.log(`    ${emailBody.replace(/\n/g, '\n    ')}`)
  // TODO: replace with actual email send (e.g. SendGrid, Resend, or Postmark)

  if (SLACK_BOT_TOKEN) {
    const slackId = await slackLookupByEmail(student.email)
    if (slackId) {
      if (DRY_RUN) {
        console.log(`  [dry-run] Would send Slack DM to ${slackId}: ${slackMessage}`)
      } else {
        const sent = await slackPostMessage(slackId, slackMessage)
        console.log(`  Slack DM to ${slackId}: ${sent ? 'sent' : 'FAILED'}`)
      }
      await notifyStaff(student.name, partnerName, referral.service_category)
    } else {
      console.log(`  No Slack user found for ${student.email} — skipping Slack DM`)
    }
  } else {
    console.log('  SLACK_BOT_TOKEN not set — skipping Slack DM')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`send-referral-followups ${DRY_RUN ? '(DRY RUN) ' : ''}— ${new Date().toISOString()}`)
  console.log()

  // ── 1. Initial requests (60+ days, never sent) ──────────────────────────────

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: initialReferrals, error: initError } = await supabase
    .from('student_referrals')
    .select(`
      id, referral_date, service_category, rating_request_sent_at, student_user_id,
      partners (name),
      users!student_referrals_student_user_id_fkey (name, email)
    `)
    .eq('direction', 'outbound')
    .not('student_user_id', 'is', null)
    .is('rating_request_sent_at', null)
    .lte('referral_date', sixtyDaysAgo.slice(0, 10))

  if (initError) {
    console.error('Error fetching initial referrals:', initError.message)
    process.exit(1)
  }

  const initial = (initialReferrals ?? []) as unknown as ReferralRow[]
  console.log(`Initial requests to send: ${initial.length}`)

  for (const referral of initial) {
    const student = getStudentInfo(referral)
    const partnerName = getPartnerName(referral)
    console.log(`  Referral ${referral.id} — ${student?.name ?? 'unknown'} → ${partnerName}`)

    if (!DRY_RUN) {
      await sendNotification(referral, 'initial')

      const { error: updateError } = await supabase
        .from('student_referrals')
        .update({ rating_request_sent_at: new Date().toISOString() })
        .eq('id', referral.id)

      if (updateError) {
        console.error(`    Failed to mark sent: ${updateError.message}`)
      } else {
        console.log(`    Marked rating_request_sent_at = now()`)
      }
    } else {
      console.log(`  [dry-run] Would notify ${student?.email} and mark sent`)
    }
  }

  console.log()

  // ── 2. Reminders (sent 7 or 14 days ago, no rating yet) ────────────────────

  const now = Date.now()

  for (const days of [7, 14] as const) {
    const windowStart = new Date(now - (days + 1) * 24 * 60 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now - (days - 1) * 24 * 60 * 60 * 1000).toISOString()

    const { data: candidateReferrals, error: reminderError } = await supabase
      .from('student_referrals')
      .select(`
        id, referral_date, service_category, rating_request_sent_at, student_user_id,
        partners (name),
        users!student_referrals_student_user_id_fkey (name, email)
      `)
      .eq('direction', 'outbound')
      .not('student_user_id', 'is', null)
      .not('rating_request_sent_at', 'is', null)
      .gte('rating_request_sent_at', windowStart)
      .lte('rating_request_sent_at', windowEnd)

    if (reminderError) {
      console.error(`Error fetching ${days}-day reminders:`, reminderError.message)
      continue
    }

    const candidates = (candidateReferrals ?? []) as unknown as ReferralRow[]

    // Filter out referrals that already have a student rating
    const candidateIds = candidates.map(r => r.id)
    const ratedIds = new Set<string>()

    if (candidateIds.length > 0) {
      const { data: existingRatings } = await supabase
        .from('partner_ratings')
        .select('referral_id')
        .in('referral_id', candidateIds)
        .eq('reviewer_type', 'student')

      for (const r of existingRatings ?? []) {
        if (r.referral_id) ratedIds.add(r.referral_id)
      }
    }

    const toRemind = candidates.filter(r => !ratedIds.has(r.id))
    console.log(`${days}-day reminders to send: ${toRemind.length}`)

    for (const referral of toRemind) {
      const student = getStudentInfo(referral)
      const partnerName = getPartnerName(referral)
      console.log(`  Referral ${referral.id} — ${student?.name ?? 'unknown'} → ${partnerName}`)

      if (!DRY_RUN) {
        await sendNotification(referral, days === 7 ? 'reminder7' : 'reminder14')
      } else {
        console.log(`  [dry-run] Would send ${days}-day reminder to ${student?.email}`)
      }
    }

    console.log()
  }

  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

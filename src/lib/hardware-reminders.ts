// Pure rules for hotspot plans and the daily reminders job (Phase 7). No database access.
// See _plans/hardware-tracker-roadmap.md.

import { KIND_LABELS, type DeviceKind } from '@/lib/hardware'

/** Alert this many days before a hotspot plan ends. */
export const RENEWAL_ALERT_DAYS = 45

/** Breaks that start within this many days of each other are one break period. */
const SAME_BREAK_DAYS = 21

/** A graduate-review reminder missed by a failed run is still sent within this many days. */
const GRADUATE_CATCH_UP_DAYS = 7

export const HARDWARE_SLACK_CHANNEL_DEFAULT = 'C0ABALJLBFU' // #student-hardware

/** Who students contact about returns (shipping labels, lost boxes, reimbursement). */
export const RETURN_CONTACT = 'Catie'

/** How to send equipment back; shown on My Equipment and in every return reminder. */
export const RETURN_STEPS = [
  `Use the box it came in. If you no longer have the box, reach out to ${RETURN_CONTACT} before you ship.`,
  "Pack it carefully. You're responsible for packing it so it arrives safely. Wrap it with padding so nothing can move or break in transit.",
  `Shipping is covered. ${RETURN_CONTACT} can send you a prepaid shipping label. Or, if you ship it yourself, keep your receipt and send it to ${RETURN_CONTACT} to be reimbursed.`,
] as const

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days from date-only `from` to date-only `to` ("2026-10-16"); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export type Subscription = {
  id: string
  device_id: string
  carrier: string
  plan: string | null
  starts_on: string
  ends_on: string
  cost: number | null
  account_number: string | null
  line_number: string | null
  notes: string | null
  created_at: string
}

/** The plan that counts now: the one ending last. */
export function currentSubscription<T extends Pick<Subscription, 'ends_on'>>(subs: T[]): T | null {
  return subs.reduce<T | null>((best, s) => (!best || s.ends_on > best.ends_on ? s : best), null)
}

export type RenewalState = 'expired' | 'due' | 'ok'

/** Has the plan ended, is it within the renewal window, or is it fine? `today` is a Pacific date. */
export function renewalState(endsOn: string, today: string): RenewalState {
  const left = daysBetween(today, endsOn)
  if (left < 0) return 'expired'
  if (left <= RENEWAL_ALERT_DAYS) return 'due'
  return 'ok'
}

/**
 * When the next return reminder goes out, after `sentSoFar` reminders (including the one
 * just sent): 5 days after the first, then every 7 days until it's received.
 */
export function nextReturnReminderAt(sentSoFar: number, from: Date): Date {
  return new Date(from.getTime() + (sentSoFar <= 1 ? 5 : 7) * DAY_MS)
}

/** The reminder a student gets, as plain text (Slack and email) and a short bell line. */
export function returnReminderText(
  name: string | null,
  items: { asset_tag: string | null; kind: DeviceKind }[],
  equipmentUrl: string,
): { subject: string; text: string; bell: string } {
  const list = items.map(i => `${KIND_LABELS[i.kind].toLowerCase()} (${i.asset_tag})`).join(', ')
  const one = items.length === 1
  return {
    subject: `Please send back your AnnieCannons ${one ? KIND_LABELS[items[0].kind].toLowerCase() : 'equipment'}`,
    bell: `Please send back your ${list}. See how on My Equipment.`,
    text: [
      `Hi${name ? ` ${name.split(' ')[0]}` : ''}, this is a reminder to send back your AnnieCannons ${list}.`,
      '',
      'How to send it back:',
      ...RETURN_STEPS.map((s, i) => `${i + 1}. ${s}`),
      '',
      `Details: ${equipmentUrl}`,
    ].join('\n'),
  }
}

/**
 * Break periods from calendar_breaks rows: rows that start within three weeks of the
 * previous period's start are the same break (Winter Break + Holiday Break Week 1/2).
 */
export function breakPeriods(rows: { label: string; start_date: string }[]): { start: string; labels: string[] }[] {
  const sorted = [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const periods: { start: string; labels: string[] }[] = []
  for (const r of sorted) {
    const last = periods[periods.length - 1]
    if (last && daysBetween(last.start, r.start_date) < SAME_BREAK_DAYS) {
      if (!last.labels.includes(r.label)) last.labels.push(r.label)
    } else {
      periods.push({ start: r.start_date, labels: [r.label] })
    }
  }
  return periods
}

/** The break period whose graduate review is due today (its start, or a few days late after a missed run). */
export function graduateReviewDue(periods: { start: string; labels: string[] }[], today: string) {
  return periods.find(p => {
    const since = daysBetween(p.start, today)
    return since >= 0 && since < GRADUATE_CATCH_UP_DAYS
  }) ?? null
}

/** Editable fields of a hotspot plan. Empty strings mean "not set". */
export type SubscriptionInput = {
  carrier: string
  plan: string
  startsOn: string
  endsOn: string
  cost: string
  accountNumber: string
  lineNumber: string
  notes: string
}

/** Returns an error message, or null when the plan can be saved. */
export function validateSubscriptionInput(input: SubscriptionInput): string | null {
  if (!input.carrier.trim()) return 'Enter who the plan is through (e.g. Mission Telecom).'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)) return 'Enter a start and end date.'
  if (input.endsOn <= input.startsOn) return 'The end date must be after the start date.'
  if (input.cost.trim() && !(Number(input.cost) >= 0)) return 'Cost must be a number, like 120.00.'
  return null
}

/** A renewal of `s`: starts when it ends, lasts the same length, same details. */
export function renewalOf(s: Pick<Subscription, 'carrier' | 'plan' | 'starts_on' | 'ends_on' | 'cost' | 'account_number' | 'line_number'>): SubscriptionInput {
  return {
    carrier: s.carrier, plan: s.plan ?? '', startsOn: s.ends_on, endsOn: addDays(s.ends_on, daysBetween(s.starts_on, s.ends_on)),
    cost: s.cost != null ? String(s.cost) : '', accountNumber: s.account_number ?? '', lineNumber: s.line_number ?? '', notes: '',
  }
}

/** Today's date in Pacific time ("2026-10-16"). */
export function pacificToday(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

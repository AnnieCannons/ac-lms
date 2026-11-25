// Pure rules for what a student needs, shipping and Comcast NOW plans (no database access).
// Part of New Student Onboarding — see _plans/new-student-onboarding-roadmap.md.

import { KIND_LABELS, type DeviceKind } from '@/lib/hardware'

// ── What a student needs ─────────────────────────────────────────────────────

export const LAPTOP_NEEDS = ['needs', 'own'] as const
export type LaptopNeed = (typeof LAPTOP_NEEDS)[number]
export const LAPTOP_NEED_LABELS: Record<LaptopNeed, string> = {
  needs: 'Needs one',
  own: 'Has their own',
}

export const WIFI_CHOICES = ['none', 'comcast_now', 'booster', 'hotspot'] as const
export type WifiChoice = (typeof WIFI_CHOICES)[number]
export const WIFI_LABELS: Record<WifiChoice, string> = {
  none: 'None',
  comcast_now: 'Comcast NOW',
  booster: 'Booster',
  hotspot: 'Hotspot',
}

export type StudentNeeds = { laptop: LaptopNeed; wifi: WifiChoice }

/** No row in hardware_student_needs means this. */
export const DEFAULT_NEEDS: StudentNeeds = { laptop: 'needs', wifi: 'none' }

export function isLaptopNeed(v: unknown): v is LaptopNeed {
  return typeof v === 'string' && (LAPTOP_NEEDS as readonly string[]).includes(v)
}

export function isWifiChoice(v: unknown): v is WifiChoice {
  return typeof v === 'string' && (WIFI_CHOICES as readonly string[]).includes(v)
}

/** Devices we ship for these needs (Comcast NOW is a plan, not a device). */
export function deviceKindsNeeded(needs: StudentNeeds): DeviceKind[] {
  const kinds: DeviceKind[] = []
  if (needs.laptop === 'needs') kinds.push('laptop')
  if (needs.wifi === 'hotspot' || needs.wifi === 'booster') kinds.push(needs.wifi)
  return kinds
}

/** Wifi devices a choice rules out, so their waitlist entries can be dropped when it changes. */
export function wifiKindsNotNeeded(wifi: WifiChoice): DeviceKind[] {
  return (['hotspot', 'booster'] as const).filter(k => k !== wifi)
}

// ── Shipping ─────────────────────────────────────────────────────────────────

export const CARRIERS = ['usps', 'ups', 'fedex', 'other'] as const
export type Carrier = (typeof CARRIERS)[number]
export const CARRIER_LABELS: Record<Carrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  other: 'Other',
}

export function isCarrier(v: unknown): v is Carrier {
  return typeof v === 'string' && (CARRIERS as readonly string[]).includes(v)
}

/** Tracking numbers are pasted from Pirate Ship; spaces are dropped so links work. */
export function normalizeTracking(n: string): string {
  return n.replace(/\s+/g, '').trim()
}

/** The carrier's tracking page, or null when we don't know the carrier. */
export function trackingUrl(carrier: Carrier, trackingNumber: string): string | null {
  const n = encodeURIComponent(normalizeTracking(trackingNumber))
  if (!n) return null
  if (carrier === 'usps') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
  if (carrier === 'ups') return `https://www.ups.com/track?tracknum=${n}`
  if (carrier === 'fedex') return `https://www.fedex.com/fedextrack/?trknbr=${n}`
  return null
}

export type Shipment = {
  id: string
  student_id: string
  device_ids: string[]
  carrier: Carrier
  tracking_number: string
  shipped_on: string
  received_at: string | null
  received_by: string | null
  notes: string | null
  created_at: string
}

export type ShipInput = {
  studentId: string
  /** In-stock devices to loan and put in the box */
  loanDeviceIds: string[]
  /** Devices already with the student (loaned earlier, or a replacement) going in the same box */
  heldDeviceIds: string[]
  carrier: Carrier
  trackingNumber: string
  /** YYYY-MM-DD */
  shippedOn: string
  notes: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateOnly(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
}

export function validateShipInput(input: ShipInput): string | null {
  if (input.loanDeviceIds.length + input.heldDeviceIds.length === 0) return 'Choose at least one device.'
  if (new Set([...input.loanDeviceIds, ...input.heldDeviceIds]).size !== input.loanDeviceIds.length + input.heldDeviceIds.length) return 'A device is listed twice.'
  if (!isCarrier(input.carrier)) return 'Choose a carrier.'
  if (!normalizeTracking(input.trackingNumber)) return 'Add the tracking number.'
  if (normalizeTracking(input.trackingNumber).length > 60) return 'That tracking number is too long.'
  if (!isDateOnly(input.shippedOn)) return 'Choose the date it shipped.'
  return null
}

/** "laptop", "laptop and hotspot", "laptop, hotspot and wifi booster" */
export function kindList(kinds: DeviceKind[]): string {
  const words = [...new Set(kinds)].map(k => KIND_LABELS[k].toLowerCase())
  if (words.length <= 1) return words[0] ?? 'equipment'
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The bell, Slack DM and email a student gets when their box ships. */
export function shippedMessage(
  name: string | null,
  kinds: DeviceKind[],
  carrier: Carrier,
  trackingNumber: string,
  equipmentUrl: string,
): { bell: string; text: string; subject: string } {
  const what = kindList(kinds)
  const verb = new Set(kinds).size > 1 ? 'are' : 'is'
  const link = trackingUrl(carrier, trackingNumber)
  const tracking = `${CARRIER_LABELS[carrier]} tracking number: ${normalizeTracking(trackingNumber)}${link ? `\n${link}` : ''}`
  return {
    bell: `Your ${what} shipped! ${CARRIER_LABELS[carrier]} tracking: ${normalizeTracking(trackingNumber)}`,
    subject: `Your AnnieCannons ${what} ${verb} on the way`,
    text: [
      `Hi${name ? ` ${name.split(' ')[0]}` : ''}! Your AnnieCannons ${what} ${verb} on the way.`,
      tracking,
      `When it arrives, open My Equipment and click "I got it" so we know: ${equipmentUrl}`,
    ].join('\n\n'),
  }
}

/** Shipments still on their way, newest first. */
export function inTransit(shipments: Shipment[]): Shipment[] {
  return shipments.filter(s => !s.received_at).sort((a, b) => b.shipped_on.localeCompare(a.shipped_on) || b.created_at.localeCompare(a.created_at))
}

/** The most recent shipment a device went out in. */
export function latestShipmentFor(deviceId: string, shipments: Shipment[]): Shipment | null {
  return shipments
    .filter(s => s.device_ids.includes(deviceId))
    .sort((a, b) => b.shipped_on.localeCompare(a.shipped_on) || b.created_at.localeCompare(a.created_at))[0] ?? null
}

// ── What the student is still waiting for ────────────────────────────────────

/**
 * `finish_first`: they're in an Enrollment Readiness course and haven't finished it yet.
 * `preparing`: they're on the waitlist (or finished), and it hasn't shipped.
 */
export type PendingState = 'finish_first' | 'preparing'
export type PendingItem = { kind: DeviceKind; state: PendingState }

export function pendingEquipment(input: {
  needs: StudentNeeds
  /** Kinds the student has right now (shipped ones included) */
  heldKinds: DeviceKind[]
  /** Kinds they have an open waitlist entry for */
  waitingKinds: DeviceKind[]
  /** Their Enrollment Readiness status, or null if they aren't in a current one */
  onboarding: 'in_progress' | 'finished' | null
}): PendingItem[] {
  const held = new Set(input.heldKinds)
  const waiting = new Set(input.waitingKinds)
  const kinds = [...new Set([...deviceKindsNeeded(input.needs), ...input.waitingKinds])]
  const out: PendingItem[] = []
  for (const kind of kinds) {
    if (held.has(kind) && !waiting.has(kind)) continue
    if (waiting.has(kind) || input.onboarding === 'finished') out.push({ kind, state: 'preparing' })
    else if (input.onboarding === 'in_progress') out.push({ kind, state: 'finish_first' })
  }
  return out
}

// ── Comcast NOW plans ────────────────────────────────────────────────────────

export type InternetPlan = {
  id: string
  student_id: string
  provider: string
  account_number: string | null
  monthly_cost: number | null
  starts_on: string
  ends_on: string | null
  notes: string | null
  created_at: string
}

export type InternetPlanInput = {
  accountNumber: string
  monthlyCost: string
  startsOn: string
  endsOn: string
  notes: string
}

export function validateInternetPlanInput(input: InternetPlanInput): string | null {
  if (!isDateOnly(input.startsOn)) return 'Choose the date the plan started.'
  if (input.endsOn.trim() && !isDateOnly(input.endsOn.trim())) return 'The end date isn’t a date.'
  if (input.endsOn.trim() && input.endsOn.trim() < input.startsOn) return 'The end date is before the start date.'
  if (input.monthlyCost.trim()) {
    const cost = Number(input.monthlyCost.replace(/[$,\s]/g, ''))
    if (!Number.isFinite(cost) || cost < 0) return 'The monthly cost should be a number, like 30 or 30.00.'
  }
  return null
}

export function parseCost(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, '')
  return clean ? Number(clean) : null
}

/** A plan that hasn't ended (one starting later still counts, so it shows up). */
export function isPlanCurrent(plan: Pick<InternetPlan, 'ends_on'>, today: string): boolean {
  return !plan.ends_on || plan.ends_on >= today
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The plan's billing day in a given month, moved back to the last day of short months. */
export function monthlyDate(startsOn: string, year: number, month: number): string {
  const day = Number(startsOn.slice(8, 10))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad(month)}-${pad(Math.min(day, lastDay))}`
}

/** True on each monthly anniversary of the start date (not the start date itself) while the plan runs. */
export function renewsToday(plan: Pick<InternetPlan, 'starts_on' | 'ends_on'>, today: string): boolean {
  if (today <= plan.starts_on || !isPlanCurrent(plan, today)) return false
  const [y, m] = today.split('-').map(Number)
  return monthlyDate(plan.starts_on, y, m) === today
}

/** The next billing date on or after `today`, or null once the plan has ended. */
export function nextRenewal(plan: Pick<InternetPlan, 'starts_on' | 'ends_on'>, today: string): string | null {
  if (!isPlanCurrent(plan, today)) return null
  let [y, m] = (today > plan.starts_on ? today : plan.starts_on).split('-').map(Number)
  for (let i = 0; i < 13; i++) {
    const d = monthlyDate(plan.starts_on, y, m)
    if (d > plan.starts_on && d >= today) return plan.ends_on && d > plan.ends_on ? null : d
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return null
}

/** hardware_alerts_sent key, so each month's reminder goes once. */
export function internetRenewalKey(planId: string, date: string): string {
  return `internet:${planId}:${date}`
}

export function ordinalDay(date: string): string {
  const d = Number(date.slice(8, 10))
  const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'
  return `${d}${suffix}`
}

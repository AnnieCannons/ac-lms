// Pure rules for the equipment check-in (Phase 6): what a student's answers mean for the
// tracker. No database access. See _plans/hardware-tracker-roadmap.md.

import { serialKey, type DeviceStatus } from '@/lib/hardware'

export const CHECKIN_NOTIFICATION_TYPE = 'hardware_checkin'
export const CHECKIN_PATH = '/student/equipment-check-in'

/** What the student fills in. Empty strings mean "not given". */
export type CheckinInput = {
  hasLaptop: boolean
  laptopSerial: string
  hasHotspot: boolean
  hotspotImei: string
  hotspotPhone: string
  hasBooster: boolean
  laptopReplaced: boolean
  chargerReplaced: boolean
  notes: string
}

export const emptyCheckinInput = (): CheckinInput => ({
  hasLaptop: false, laptopSerial: '', hasHotspot: false, hotspotImei: '', hotspotPhone: '',
  hasBooster: false, laptopReplaced: false, chargerReplaced: false, notes: '',
})

export type CheckinResponse = {
  id: string
  survey_id: string
  user_id: string
  has_laptop: boolean
  laptop_serial: string | null
  has_hotspot: boolean
  hotspot_imei: string | null
  hotspot_phone: string | null
  has_booster: boolean
  laptop_replaced: boolean
  charger_replaced: boolean
  notes: string | null
  submitted_at: string
  updated_at: string
  review_status: 'pending' | 'approved' | 'dismissed'
  reviewed_at: string | null
  review_note: string | null
}

export function responseToInput(r: CheckinResponse | null): CheckinInput {
  if (!r) return emptyCheckinInput()
  return {
    hasLaptop: r.has_laptop, laptopSerial: r.laptop_serial ?? '', hasHotspot: r.has_hotspot,
    hotspotImei: r.hotspot_imei ?? '', hotspotPhone: r.hotspot_phone ?? '', hasBooster: r.has_booster,
    laptopReplaced: r.laptop_replaced, chargerReplaced: r.charger_replaced, notes: r.notes ?? '',
  }
}

/** Returns an error message, or null when the answers can be saved. */
export function validateCheckinInput(input: CheckinInput): string | null {
  if (input.hasLaptop && !input.laptopSerial.trim()) return "Enter your laptop's serial number (see \"Where do I find it?\")."
  if (input.hasHotspot && !input.hotspotImei.trim() && !input.hotspotPhone.trim()) {
    return "Enter your hotspot's IMEI or phone number (see \"Where do I find it?\")."
  }
  if (input.laptopSerial.length > 100 || input.hotspotImei.length > 40 || input.hotspotPhone.length > 40) return 'That number looks too long.'
  if (input.notes.length > 2000) return 'Keep notes under 2,000 characters.'
  return null
}

/** A device already in the tracker that an answer might refer to. */
export type DeviceMatch = {
  id: string
  asset_tag: string | null
  kind: string
  status: DeviceStatus
  current_holder_id: string | null
  serial_number: string | null
  imei: string | null
  phone_number: string | null
}

/** What approving one part of a response would do. */
export type PlanStep =
  | { action: 'none' }
  | { action: 'create' }
  | { action: 'link'; device: DeviceMatch }
  | { action: 'already'; device: DeviceMatch }
  | { action: 'conflict'; device: DeviceMatch; reason: string }

export type CheckinPlan = {
  laptop: PlanStep
  hotspot: PlanStep
  booster: PlanStep
  laptopReplacement: boolean
  chargerReplacement: boolean
}

/** Statuses an unheld device can be in and still be linked to the student who says they have it. */
const LINKABLE: DeviceStatus[] = ['in_stock', 'received', 'needs_prep']

function stepFor(studentId: string, match: DeviceMatch | undefined): PlanStep {
  if (!match) return { action: 'create' }
  if (match.current_holder_id === studentId) return { action: 'already', device: match }
  if (match.current_holder_id) return { action: 'conflict', device: match, reason: 'The tracker says someone else has it.' }
  if (LINKABLE.includes(match.status)) return { action: 'link', device: match }
  return { action: 'conflict', device: match, reason: `The tracker has it as ${match.status.replace(/_/g, ' ')}.` }
}

/**
 * What approving this response would do, given the devices already in the tracker and the
 * replacements already recorded for the student.
 */
export function planCheckin(
  r: Pick<CheckinResponse, 'user_id' | 'has_laptop' | 'laptop_serial' | 'has_hotspot' | 'hotspot_imei' | 'hotspot_phone' | 'has_booster' | 'laptop_replaced' | 'charger_replaced'>,
  devices: DeviceMatch[],
  replacementsRecorded: { laptop: number; charger: number },
): CheckinPlan {
  const laptopSerial = r.laptop_serial?.trim() ? serialKey(r.laptop_serial) : null
  const laptop: PlanStep = r.has_laptop && laptopSerial
    ? stepFor(r.user_id, devices.find(d => d.kind === 'laptop' && d.serial_number && serialKey(d.serial_number) === laptopSerial))
    : { action: 'none' }

  const imei = r.hotspot_imei?.trim() || null
  const phone = digits(r.hotspot_phone)
  const hotspotMatch = devices.find(d => d.kind === 'hotspot' && imei && d.imei?.trim() === imei)
    ?? devices.find(d => d.kind === 'hotspot' && phone && digits(d.phone_number) === phone)
  const hotspot: PlanStep = r.has_hotspot && (imei || phone) ? stepFor(r.user_id, hotspotMatch) : { action: 'none' }

  const heldBooster = devices.find(d => d.kind === 'booster' && d.current_holder_id === r.user_id)
  const booster: PlanStep = !r.has_booster ? { action: 'none' } : heldBooster ? { action: 'already', device: heldBooster } : { action: 'create' }

  return {
    laptop,
    hotspot,
    booster,
    laptopReplacement: r.laptop_replaced && replacementsRecorded.laptop === 0,
    chargerReplacement: r.charger_replaced && replacementsRecorded.charger === 0,
  }
}

/** Phone numbers compared by their digits only ("(510) 555-0100" = "510.555.0100"). */
function digits(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\D/g, '')
  return d.length >= 7 ? d.slice(-10) : null
}

// Pure rules for Equipment Support Form tickets (Phase 8). No database access.
// See _plans/hardware-tracker-roadmap.md.

import type { DeviceKind } from '@/lib/hardware'

export const TICKET_STATUSES = ['open', 'in_progress', 'replacement_sent', 'resolved'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  replacement_sent: 'Replacement sent',
  resolved: 'Resolved',
}

/** Open tickets nobody has touched for this long get a nudge in #student-hardware. */
export const TICKET_NUDGE_HOURS = 48

export const TICKET_ALERT_TYPE = 'hardware_ticket'

export type Ticket = {
  id: string
  airtable_record_id: string | null
  airtable_url: string | null
  submitted_email: string | null
  submitted_name: string | null
  equipment_type: string | null
  issue: string | null
  other_info: string | null
  student_id: string | null
  device_id: string | null
  status: TicketStatus
  last_activity_at: string
  last_nudged_at: string | null
  resolved_at: string | null
  created_at: string
}

export type TicketPayload = {
  recordId: string
  recordUrl: string | null
  email: string | null
  name: string | null
  equipment: string | null
  issue: string | null
  otherInfo: string | null
}

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/**
 * Reads the webhook body from the Airtable automation. Only the fields below are kept;
 * anything else (an address, if one were ever sent) is ignored and never stored.
 */
export function parseTicketPayload(body: unknown): TicketPayload | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Expected a JSON object.' }
  const b = body as Record<string, unknown>
  const recordId = clip(b.recordId, 64)
  if (!recordId || !/^rec[A-Za-z0-9]{3,}$/.test(recordId)) return { error: 'recordId must be an Airtable record id (rec…).' }
  const url = clip(b.recordUrl, 300)
  return {
    recordId,
    recordUrl: url && url.startsWith('https://airtable.com/') ? url : null,
    email: clip(b.email, 200)?.toLowerCase() ?? null,
    name: clip(b.name, 200),
    equipment: clip(b.equipment, 100),
    issue: clip(b.issue, 5000),
    otherInfo: clip(b.otherInfo, 5000),
  }
}

/** Which device types the form's equipment choice refers to. */
export function kindsForEquipment(equipment: string | null): DeviceKind[] {
  const e = (equipment ?? '').toLowerCase()
  if (e.startsWith('laptop')) return ['laptop'] // "Laptop" and "Laptop Charger"
  if (e.includes('wifi') || e.includes('wi-fi') || e.includes('hotspot') || e.includes('booster')) return ['hotspot', 'booster']
  return []
}

/** The student's device the ticket is about, when there's exactly one of the right type. */
export function pickTicketDevice<T extends { id: string; kind: DeviceKind }>(held: T[], equipment: string | null): T | null {
  const kinds = kindsForEquipment(equipment)
  const matches = held.filter(d => kinds.includes(d.kind))
  return matches.length === 1 ? matches[0] : null
}

/** Has an open ticket been left alone long enough to nudge (and not nudged since)? */
export function ticketNeedsNudge(t: Pick<Ticket, 'status' | 'last_activity_at' | 'last_nudged_at'>, now: Date): boolean {
  if (t.status === 'resolved') return false
  const cutoff = now.getTime() - TICKET_NUDGE_HOURS * 60 * 60 * 1000
  const since = Math.max(Date.parse(t.last_activity_at), t.last_nudged_at ? Date.parse(t.last_nudged_at) : 0)
  return since <= cutoff
}

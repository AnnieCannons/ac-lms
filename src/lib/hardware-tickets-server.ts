import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { slackPostMessage } from '@/lib/slack'
import { DEVICE_COLUMNS, loadPeople, type Person } from '@/lib/hardware-server'
import { HARDWARE_SLACK_CHANNEL_DEFAULT } from '@/lib/hardware-reminders'
import { primaryIdentifier, type HardwareDevice } from '@/lib/hardware'
import { pickTicketDevice, TICKET_ALERT_TYPE, type Ticket, type TicketPayload } from '@/lib/hardware-tickets'

// Server-only ticket logic: the webhook's create step and the staff pages' loaders.
// Callers check access first (webhook secret, or getHardwareViewer).

type Admin = ReturnType<typeof createServiceSupabaseClient>

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com'
const channel = () => process.env.SLACK_HARDWARE_CHANNEL || HARDWARE_SLACK_CHANNEL_DEFAULT

/** Staff who get bell notifications for hardware alerts (same list as renewals). */
async function alertStaffIds(admin: Admin): Promise<string[]> {
  const emails = (process.env.HARDWARE_ALERT_EMAILS || process.env.STAFF_NOTIFY_EMAIL || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  if (emails.length === 0) return []
  const { data } = await admin.from('users').select('id').in('email', emails)
  return ((data ?? []) as { id: string }[]).map(u => u.id)
}

/** `ilike` without wildcards: the value matched literally, ignoring case (emails often contain "_"). */
const literal = (v: string) => v.replace(/[\\%_]/g, '\\$&')

/** Finds the student: by email, else by an exact (case-insensitive) name that only one student has. */
async function matchStudent(admin: Admin, email: string | null, name: string | null): Promise<Person | null> {
  if (email) {
    const { data } = await admin.from('users').select('id, name, email').ilike('email', literal(email)).limit(1)
    if (data?.length) return data[0] as Person
  }
  if (name) {
    const { data } = await admin.from('users').select('id, name, email').eq('role', 'student').ilike('name', literal(name)).limit(2)
    if (data?.length === 1) return data[0] as Person
  }
  return null
}

const quote = (text: string, max = 600) => {
  const t = text.length > max ? `${text.slice(0, max)}…` : text
  return t.split('\n').map(l => `> ${l}`).join('\n')
}

/**
 * Stores a ticket from the Airtable webhook (once per Airtable record), matching the
 * student and device, then posts it in #student-hardware and to the staff bell.
 */
export async function createTicketFromPayload(admin: Admin, p: TicketPayload): Promise<{ ticketId: string; duplicate: boolean; studentMatched: boolean; deviceMatched: boolean }> {
  const { data: existing } = await admin.from('hardware_tickets').select('id, student_id, device_id').eq('airtable_record_id', p.recordId).maybeSingle()
  if (existing) return { ticketId: existing.id, duplicate: true, studentMatched: !!existing.student_id, deviceMatched: !!existing.device_id }

  const student = await matchStudent(admin, p.email, p.name)
  let device: HardwareDevice | null = null
  if (student) {
    const { data: held } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('current_holder_id', student.id)
    device = pickTicketDevice((held as HardwareDevice[] | null) ?? [], p.equipment)
  }

  const { data: ticket, error } = await admin.from('hardware_tickets').insert({
    airtable_record_id: p.recordId,
    airtable_url: p.recordUrl,
    submitted_email: p.email,
    submitted_name: p.name,
    equipment_type: p.equipment,
    issue: p.issue,
    other_info: p.otherInfo,
    student_id: student?.id ?? null,
    device_id: device?.id ?? null,
  }).select('id').single()
  if (error || !ticket) {
    // A second delivery racing the first hits the unique record id: treat it as a duplicate.
    if (error?.code === '23505') {
      const { data: again } = await admin.from('hardware_tickets').select('id').eq('airtable_record_id', p.recordId).maybeSingle()
      if (again) return { ticketId: again.id, duplicate: true, studentMatched: !!student, deviceMatched: !!device }
    }
    throw new Error(error?.message ?? 'Could not save the ticket.')
  }

  await admin.from('hardware_events').insert({
    device_id: device?.id ?? null, student_id: student?.id ?? null, type: 'ticket_opened',
    notes: [p.equipment, p.issue].filter(Boolean).join(': ') || 'Support form submitted',
  }).then(() => undefined, () => undefined)

  const who = student ? (student.name ?? student.email) : (p.name ?? p.email ?? 'someone')
  const deviceLine = device
    ? `<${appUrl()}/instructor/hardware/devices/${device.id}|${device.asset_tag}>${[device.make_model, device.model_year].filter(Boolean).length ? ` · ${[device.make_model, device.model_year].filter(Boolean).join(' · ')}` : ''}${primaryIdentifier(device) ? ` · ${primaryIdentifier(device)}` : ''}`
    : student ? `_Couldn't tell which device. Check ${who}'s hardware page._` : `_Couldn't match ${p.email ?? 'this email'} to a student in the LMS._`
  const lines = [
    `🛠️ *${p.equipment ?? 'Equipment'} issue* from ${student ? `<${appUrl()}/instructor/hardware/students/${student.id}|${who}>` : who}`,
    deviceLine,
    ...(p.issue ? [quote(p.issue)] : []),
    ...(p.otherInfo ? [`_Also:_ ${p.otherInfo.slice(0, 300)}`] : []),
    `<${appUrl()}/instructor/hardware/tickets/${ticket.id}|Open ticket>${p.recordUrl ? ` · <${p.recordUrl}|Airtable record (shipping address)>` : ''}`,
  ]
  await slackPostMessage(channel(), lines.join('\n'))

  const staffIds = await alertStaffIds(admin)
  if (staffIds.length) {
    await admin.from('notifications').insert(staffIds.map(user_id => ({
      user_id, type: TICKET_ALERT_TYPE, message: `${p.equipment ?? 'Equipment'} issue from ${who}`,
    })))
  }
  return { ticketId: ticket.id, duplicate: false, studentMatched: !!student, deviceMatched: !!device }
}

const TICKET_COLUMNS = 'id, airtable_record_id, airtable_url, submitted_email, submitted_name, equipment_type, issue, other_info, student_id, device_id, status, last_activity_at, last_nudged_at, resolved_at, created_at'

export type TicketRow = { ticket: Ticket; student: Person | null; device: HardwareDevice | null }

async function withPeopleAndDevices(admin: Admin, tickets: Ticket[]): Promise<TicketRow[]> {
  const deviceIds = [...new Set(tickets.map(t => t.device_id).filter((id): id is string => !!id))]
  const [people, { data: devices }] = await Promise.all([
    loadPeople(admin, tickets.map(t => t.student_id)),
    deviceIds.length ? admin.from('hardware_devices').select(DEVICE_COLUMNS).in('id', deviceIds) : Promise.resolve({ data: [] }),
  ])
  const byId = new Map(((devices as HardwareDevice[] | null) ?? []).map(d => [d.id, d]))
  return tickets.map(t => ({
    ticket: t,
    student: t.student_id ? people.get(t.student_id) ?? null : null,
    device: t.device_id ? byId.get(t.device_id) ?? null : null,
  }))
}

/** Tickets that aren't resolved, oldest first. */
export async function loadOpenTickets(admin: Admin): Promise<TicketRow[]> {
  const { data } = await admin.from('hardware_tickets').select(TICKET_COLUMNS).neq('status', 'resolved').order('created_at', { ascending: true })
  return withPeopleAndDevices(admin, (data as Ticket[] | null) ?? [])
}

export async function loadTicket(admin: Admin, id: string): Promise<TicketRow | null> {
  const { data } = await admin.from('hardware_tickets').select(TICKET_COLUMNS).eq('id', id).maybeSingle()
  if (!data) return null
  return (await withPeopleAndDevices(admin, [data as Ticket]))[0]
}

/** A student's tickets, newest first (for their hardware page). */
export async function loadStudentTickets(admin: Admin, studentId: string): Promise<TicketRow[]> {
  const { data } = await admin.from('hardware_tickets').select(TICKET_COLUMNS).eq('student_id', studentId).order('created_at', { ascending: false })
  return withPeopleAndDevices(admin, (data as Ticket[] | null) ?? [])
}

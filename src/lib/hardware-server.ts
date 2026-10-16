import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { currentSubscription, type Subscription } from '@/lib/hardware-reminders'
import {
  sanitizeSearch,
  type DeviceKind,
  type DeviceStatus,
  type HardwareDevice,
  type HardwareEvent,
  type ReturnRequest,
  isReadyToTransfer,
  laptopTrackFromName,
} from '@/lib/hardware'

// Server-only loaders for the Hardware Tracker pages. Callers must have checked access
// (getHardwareViewer) before passing a service-role client in.

type Admin = ReturnType<typeof createServiceSupabaseClient>

export const DEVICE_COLUMNS =
  'id, kind, asset_tag, serial_number, imei, iccid, phone_number, make_model, model_year, condition, purchase_batch_id, status, current_holder_id, notes, created_at, updated_at'

export type Person = { id: string; name: string | null; email: string }

export type PurchaseBatch = {
  id: string
  kind: DeviceKind
  purchased_on: string | null
  vendor: string | null
  make_model: string | null
  model_year: number | null
  condition: string | null
  unit_cost: number | null
  warranty_ends_on: string | null
  notes: string | null
  created_at: string
}

export async function loadPeople(admin: Admin, ids: (string | null)[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  const map = new Map<string, Person>()
  if (unique.length === 0) return map
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await admin.from('users').select('id, name, email').in('id', unique.slice(i, i + 200))
    for (const p of data ?? []) map.set(p.id, p as Person)
  }
  return map
}

/**
 * Devices for the main list. `q` matches asset tag, serial, IMEI, ICCID, phone number or
 * the current holder's name/email.
 */
export async function loadDevices(
  admin: Admin,
  filters: { kind?: DeviceKind; status?: DeviceStatus; q?: string } = {},
): Promise<HardwareDevice[]> {
  const q = sanitizeSearch(filters.q ?? '')
  let holderIds: string[] = []
  if (q) {
    const { data } = await admin.from('users').select('id').or(`name.ilike.*${q}*,email.ilike.*${q}*`).limit(200)
    holderIds = (data ?? []).map(u => u.id)
  }

  return fetchAllRows<HardwareDevice>((from, to) => {
    let query = admin.from('hardware_devices').select(DEVICE_COLUMNS)
    if (filters.kind) query = query.eq('kind', filters.kind)
    if (filters.status) query = query.eq('status', filters.status)
    if (q) {
      const like = `*${q}*`
      const parts = ['asset_tag', 'serial_number', 'imei', 'iccid', 'phone_number'].map(c => `${c}.ilike.${like}`)
      if (holderIds.length) parts.push(`current_holder_id.in.(${holderIds.join(',')})`)
      query = query.or(parts.join(','))
    }
    return query.order('asset_tag', { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: HardwareDevice[] | null; error: { message: string } | null }>
  })
}

export async function loadDevice(admin: Admin, id: string): Promise<HardwareDevice | null> {
  const { data } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('id', id).maybeSingle()
  return (data as HardwareDevice | null) ?? null
}

export async function loadBatch(admin: Admin, id: string | null): Promise<PurchaseBatch | null> {
  if (!id) return null
  const { data } = await admin.from('hardware_purchase_batches').select('*').eq('id', id).maybeSingle()
  return (data as PurchaseBatch | null) ?? null
}

export async function loadDeviceEvents(admin: Admin, deviceId: string): Promise<HardwareEvent[]> {
  const { data } = await admin.from('hardware_events').select('*').eq('device_id', deviceId).order('created_at', { ascending: false })
  return (data as HardwareEvent[] | null) ?? []
}

/** A student's current devices, plus every device that has ever been linked to them. */
export async function loadStudentHardware(admin: Admin, studentId: string) {
  const [{ data: current }, { data: events }] = await Promise.all([
    admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('current_holder_id', studentId).order('asset_tag'),
    admin.from('hardware_events').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
  ])
  const currentDevices = (current as HardwareDevice[] | null) ?? []
  const history = (events as HardwareEvent[] | null) ?? []
  const pastIds = [...new Set(history.map(e => e.device_id).filter((id): id is string => !!id))]
    .filter(id => !currentDevices.some(d => d.id === id))
  const { data: past } = pastIds.length
    ? await admin.from('hardware_devices').select(DEVICE_COLUMNS).in('id', pastIds)
    : { data: [] }
  return { currentDevices, pastDevices: (past as HardwareDevice[] | null) ?? [], history }
}

/** Students matching a name/email search, for the Students tab. */
export async function searchStudents(admin: Admin, q: string): Promise<Person[]> {
  const clean = sanitizeSearch(q)
  if (!clean) return []
  const { data } = await admin.from('users').select('id, name, email')
    .eq('role', 'student')
    .or(`name.ilike.*${clean}*,email.ilike.*${clean}*`)
    .order('name').limit(50)
  return (data as Person[] | null) ?? []
}

/** Every student who currently holds at least one device, with how many. */
export async function loadHolders(admin: Admin): Promise<{ person: Person; count: number }[]> {
  const rows = await fetchAllRows<{ current_holder_id: string | null }>((from, to) =>
    admin.from('hardware_devices').select('current_holder_id').not('current_holder_id', 'is', null).range(from, to) as unknown as PromiseLike<{ data: { current_holder_id: string | null }[] | null; error: { message: string } | null }>)
  const counts = new Map<string, number>()
  for (const r of rows) if (r.current_holder_id) counts.set(r.current_holder_id, (counts.get(r.current_holder_id) ?? 0) + 1)
  const people = await loadPeople(admin, [...counts.keys()])
  return [...counts.entries()]
    .map(([id, count]) => ({ person: people.get(id) ?? { id, name: null, email: '' }, count }))
    .sort((a, b) => (a.person.name ?? '').localeCompare(b.person.name ?? ''))
}

export type OpenReturn = { request: ReturnRequest; device: HardwareDevice; student: Person | null }

/** Every device we are waiting on, oldest request first. */
export async function loadOpenReturns(admin: Admin): Promise<OpenReturn[]> {
  const { data } = await admin.from('hardware_return_requests')
    .select('id, device_id, student_id, requested_at, closed_at, closed_reason')
    .is('closed_at', null).order('requested_at', { ascending: true })
  const requests = (data as ReturnRequest[] | null) ?? []
  if (requests.length === 0) return []
  const [{ data: devices }, people] = await Promise.all([
    admin.from('hardware_devices').select(DEVICE_COLUMNS).in('id', requests.map(r => r.device_id)),
    loadPeople(admin, requests.map(r => r.student_id)),
  ])
  const byId = new Map(((devices as HardwareDevice[] | null) ?? []).map(d => [d.id, d]))
  return requests
    .filter(r => byId.has(r.device_id))
    .map(r => ({ request: r, device: byId.get(r.device_id)!, student: r.student_id ? people.get(r.student_id) ?? null : null }))
}

/** The open return request for one device, if any. */
export async function loadOpenReturnForDevice(admin: Admin, deviceId: string): Promise<ReturnRequest | null> {
  const { data } = await admin.from('hardware_return_requests')
    .select('id, device_id, student_id, requested_at, closed_at, closed_reason')
    .eq('device_id', deviceId).is('closed_at', null).maybeSingle()
  return (data as ReturnRequest | null) ?? null
}

// ── Ownership, replacements and waitlist (Phase 3b) ──────────────────────────

export type WaitlistEntry = { id: string; kind: DeviceKind; note: string | null; added_at: string; student: Person }

/** Open waitlist entries, oldest first (first come, first served). */
export async function loadWaitlist(admin: Admin, kind?: DeviceKind): Promise<WaitlistEntry[]> {
  let query = admin.from('hardware_waitlist').select('id, kind, note, added_at, student_id')
    .is('fulfilled_at', null).is('removed_at', null)
  if (kind) query = query.eq('kind', kind)
  const { data } = await query.order('added_at', { ascending: true })
  const rows = (data as { id: string; kind: DeviceKind; note: string | null; added_at: string; student_id: string }[] | null) ?? []
  const people = await loadPeople(admin, rows.map(r => r.student_id))
  return rows.map(r => ({ id: r.id, kind: r.kind, note: r.note, added_at: r.added_at, student: people.get(r.student_id) ?? { id: r.student_id, name: null, email: '' } }))
}

/** Students with a loaned laptop who have completed both a TCF and an ITP course. */
export async function loadReadyToTransfer(admin: Admin): Promise<{ device: HardwareDevice; student: Person }[]> {
  const { data: laptops } = await admin.from('hardware_devices').select(DEVICE_COLUMNS)
    .eq('kind', 'laptop').eq('status', 'on_loan').not('current_holder_id', 'is', null)
  const loaned = (laptops as HardwareDevice[] | null) ?? []
  if (loaned.length === 0) return []
  const studentIds = [...new Set(loaned.map(d => d.current_holder_id!))]

  const [{ data: completions }, { data: trackCourses }] = await Promise.all([
    admin.from('course_completions').select('course_id, user_id').in('user_id', studentIds),
    // Course names decide the track (see laptopTrackFromName); the courses table is small.
    admin.from('courses').select('id, name'),
  ])
  const trackByCourse = new Map<string, string>()
  for (const c of (trackCourses ?? []) as { id: string; name: string }[]) {
    const track = laptopTrackFromName(c.name)
    if (track) trackByCourse.set(c.id, track)
  }
  const tracksByStudent = new Map<string, string[]>()
  for (const c of (completions ?? []) as { course_id: string; user_id: string }[]) {
    const track = trackByCourse.get(c.course_id)
    if (track) tracksByStudent.set(c.user_id, [...(tracksByStudent.get(c.user_id) ?? []), track])
  }
  const ready = loaned.filter(d => isReadyToTransfer(tracksByStudent.get(d.current_holder_id!) ?? []))
  const people = await loadPeople(admin, ready.map(d => d.current_holder_id))
  return ready.map(d => ({ device: d, student: people.get(d.current_holder_id!) ?? { id: d.current_holder_id!, name: null, email: '' } }))
}

export type Replacement = {
  id: string
  kind: 'laptop' | 'charger'
  old_device_id: string | null
  new_device_id: string | null
  old_coming_back: boolean
  write_off_reason: string | null
  override_note: string | null
  created_at: string
}

export async function loadReplacements(admin: Admin, studentId: string): Promise<Replacement[]> {
  const { data } = await admin.from('hardware_replacements')
    .select('id, kind, old_device_id, new_device_id, old_coming_back, write_off_reason, override_note, created_at')
    .eq('student_id', studentId).order('created_at', { ascending: true })
  return (data as Replacement[] | null) ?? []
}

// ── Students' own view (Phase 5) ─────────────────────────────────────────────

export type MyEquipment = {
  devices: HardwareDevice[]
  /** Devices we've asked the student to send back. */
  awaitingIds: Set<string>
  replacementsUsed: { laptop: number; charger: number }
}

/**
 * A student's own equipment for their Profile page and the return banner. Callers pass the
 * signed-in user's own id (from auth), never one from the request.
 */
export async function loadMyEquipment(admin: Admin, userId: string): Promise<MyEquipment> {
  const [{ data: devices }, { data: replacements }] = await Promise.all([
    admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('current_holder_id', userId).order('asset_tag'),
    admin.from('hardware_replacements').select('kind').eq('student_id', userId),
  ])
  const list = (devices as HardwareDevice[] | null) ?? []
  const kinds = ((replacements ?? []) as { kind: string }[]).map(r => r.kind)
  return {
    devices: list,
    awaitingIds: new Set(list.filter(d => d.status === 'awaiting_return').map(d => d.id)),
    replacementsUsed: { laptop: kinds.filter(k => k === 'laptop').length, charger: kinds.filter(k => k === 'charger').length },
  }
}

// ── Hotspot plans (Phase 7) ──────────────────────────────────────────────────

const SUBSCRIPTION_COLUMNS = 'id, device_id, carrier, plan, starts_on, ends_on, cost, account_number, line_number, notes, created_at'

export async function loadSubscriptions(admin: Admin, deviceId: string): Promise<Subscription[]> {
  const { data } = await admin.from('hardware_subscriptions').select(SUBSCRIPTION_COLUMNS).eq('device_id', deviceId).order('ends_on', { ascending: false })
  return (data as Subscription[] | null) ?? []
}

export type HotspotPlanStatus = { device: HardwareDevice; holder: Person | null; current: Subscription | null }

/** Every hotspot still in use (not lost or retired) with its current plan, for renewals. */
export async function loadHotspotPlans(admin: Admin): Promise<HotspotPlanStatus[]> {
  const [{ data: hotspots }, subs] = await Promise.all([
    admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('kind', 'hotspot').not('status', 'in', '(lost,retired)').order('asset_tag'),
    fetchAllRows<Subscription>((from, to) =>
      admin.from('hardware_subscriptions').select(SUBSCRIPTION_COLUMNS).range(from, to) as unknown as PromiseLike<{ data: Subscription[] | null; error: { message: string } | null }>),
  ])
  const devices = (hotspots as HardwareDevice[] | null) ?? []
  const people = await loadPeople(admin, devices.map(d => d.current_holder_id))
  return devices.map(d => ({
    device: d,
    holder: d.current_holder_id ? people.get(d.current_holder_id) ?? null : null,
    current: currentSubscription(subs.filter(s => s.device_id === d.id)),
  }))
}

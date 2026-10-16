'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { HARDWARE_ROLES } from '@/lib/hardware-access'
import {
  batchIdentifierField,
  batchSize,
  blankToNull,
  describeChanges,
  deviceToInput,
  parseIdentifierList,
  serialKey,
  validateBatchInput,
  validateDeviceInput,
  STATUS_LABELS,
  FIRST_RETURN_REMINDER_HOURS,
  RECEIVE_STATUSES,
  sanitizeSearch,
  type ReceiveStatus,
  validateReplacementInput,
  DEVICE_KINDS,
  type ReplacementInput,
  type BatchInput,
  type DeviceInput,
  type DeviceKind,
  type DeviceStatus,
  type HardwareDevice,
} from '@/lib/hardware'
import { DEVICE_COLUMNS, type Person } from '@/lib/hardware-server'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** Statuses staff can set by hand in Phase 1. Loan-related ones come with Phase 3. */
const MANUAL_STATUSES: DeviceStatus[] = ['in_stock', 'needs_prep', 'needs_repair', 'lost', 'retired']

/** Instructors, staff and admins manage hardware. TAs and students may not. */
async function requireHardwareStaff(): Promise<{ userId: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return HARDWARE_ROLES.includes(profile?.role ?? '') ? { userId: user.id } : null
}

function deviceRow(input: DeviceInput) {
  return {
    serial_number: blankToNull(input.serialNumber),
    imei: blankToNull(input.imei),
    iccid: blankToNull(input.iccid),
    phone_number: blankToNull(input.phoneNumber),
    make_model: blankToNull(input.makeModel),
    model_year: input.modelYear.trim() ? Number(input.modelYear) : null,
    condition: input.condition || null,
    notes: blankToNull(input.notes),
  }
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Another device already has that serial number or IMEI.'
  return error.message
}

/**
 * Of the given identifiers, the ones already on a device (serials compared ignoring case
 * and spaces). Used to warn before a bulk add instead of failing halfway.
 */
async function existingIdentifiers(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  field: 'serial_number' | 'imei',
  identifiers: string[],
): Promise<string[]> {
  if (identifiers.length === 0) return []
  const rows = await fetchAllRows<Record<string, string | null>>((from, to) =>
    admin.from('hardware_devices').select(field).not(field, 'is', null).range(from, to) as unknown as PromiseLike<{ data: Record<string, string | null>[] | null; error: { message: string } | null }>)
  const taken = new Set(rows.map(r => serialKey(r[field] ?? '')))
  return identifiers.filter(id => taken.has(serialKey(id)))
}

export async function createHardwareDevice(input: DeviceInput): Promise<Result<{ id: string }>> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const invalid = validateDeviceInput(input)
  if (invalid) return { ok: false, error: invalid }

  const admin = createServiceSupabaseClient()
  const { data, error } = await admin.from('hardware_devices')
    .insert({ kind: input.kind, ...deviceRow(input), created_by: staff.userId })
    .select('id').single()
  if (error || !data) return { ok: false, error: error ? friendlyDbError(error) : 'Could not add the device.' }

  await admin.from('hardware_events').insert({ device_id: data.id, type: 'added', actor_id: staff.userId })
  return { ok: true, id: data.id }
}

/** Checks a bulk add before saving: which pasted identifiers are already in the tracker. */
export async function checkHardwareBatch(kind: DeviceKind, identifiers: string): Promise<Result<{ alreadyAdded: string[] }>> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const field = batchIdentifierField(kind)
  if (!field) return { ok: true, alreadyAdded: [] }
  const admin = createServiceSupabaseClient()
  return { ok: true, alreadyAdded: await existingIdentifiers(admin, field, parseIdentifierList(identifiers).identifiers) }
}

/**
 * Adds one purchase: a batch row with the shared details, then one device per pasted
 * identifier (or `count` boosters), each tagged by the database. Refuses the whole batch if
 * any identifier is already in the tracker, so nothing is half-added.
 */
export async function createHardwarePurchaseBatch(input: BatchInput): Promise<Result<{ batchId: string; created: number }>> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const invalid = validateBatchInput(input)
  if (invalid) return { ok: false, error: invalid }

  const admin = createServiceSupabaseClient()
  const field = batchIdentifierField(input.kind)
  const identifiers = field ? parseIdentifierList(input.identifiers).identifiers : []
  if (field) {
    const taken = await existingIdentifiers(admin, field, identifiers)
    if (taken.length) return { ok: false, error: `Already in the tracker: ${taken.join(', ')}` }
  }

  const shared = {
    make_model: blankToNull(input.makeModel),
    model_year: input.modelYear.trim() ? Number(input.modelYear) : null,
    condition: input.condition || null,
  }
  const { data: batch, error: batchError } = await admin.from('hardware_purchase_batches').insert({
    kind: input.kind,
    purchased_on: input.purchasedOn || null,
    vendor: blankToNull(input.vendor),
    unit_cost: input.unitCost.trim() ? Number(input.unitCost) : null,
    warranty_ends_on: input.warrantyEndsOn || null,
    notes: blankToNull(input.notes),
    created_by: staff.userId,
    ...shared,
  }).select('id').single()
  if (batchError || !batch) return { ok: false, error: batchError?.message ?? 'Could not save the purchase.' }

  const count = batchSize(input)
  const rows = Array.from({ length: count }, (_, i) => ({
    kind: input.kind,
    purchase_batch_id: batch.id,
    created_by: staff.userId,
    ...shared,
    ...(field ? { [field]: identifiers[i] } : {}),
  }))
  const { data: devices, error } = await admin.from('hardware_devices').insert(rows).select('id')
  if (error || !devices) {
    // Don't leave an empty purchase behind when the devices could not be added.
    await admin.from('hardware_purchase_batches').delete().eq('id', batch.id)
    return { ok: false, error: error ? friendlyDbError(error) : 'Could not add the devices.' }
  }

  await admin.from('hardware_events').insert(devices.map(d => ({
    device_id: d.id, type: 'added', notes: 'Added with a purchase', actor_id: staff.userId,
  })))
  return { ok: true, batchId: batch.id, created: devices.length }
}

export async function updateHardwareDevice(id: string, input: DeviceInput): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: existing } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('id', id).maybeSingle()
  if (!existing) return { ok: false, error: 'Device not found.' }
  const before = deviceToInput(existing as HardwareDevice)
  // The type of a device never changes after it is added.
  const after = { ...input, kind: before.kind }
  const invalid = validateDeviceInput(after)
  if (invalid) return { ok: false, error: invalid }

  const changes = describeChanges(before, after)
  if (changes.length === 0) return { ok: true }

  const { error } = await admin.from('hardware_devices')
    .update({ ...deviceRow(after), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: friendlyDbError(error) }

  await admin.from('hardware_events').insert({ device_id: id, type: 'edited', notes: changes.join('\n'), actor_id: staff.userId })
  return { ok: true }
}

/** Sets a status that doesn't involve a student (in stock, needs prep/repair, lost, retired). */
export async function setHardwareDeviceStatus(id: string, status: DeviceStatus, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  if (!MANUAL_STATUSES.includes(status)) return { ok: false, error: 'That status is set from a loan, not by hand.' }

  const admin = createServiceSupabaseClient()
  const { data: existing } = await admin.from('hardware_devices').select('status, current_holder_id').eq('id', id).maybeSingle()
  if (!existing) return { ok: false, error: 'Device not found.' }
  if (existing.current_holder_id) return { ok: false, error: 'This device is with a student. Change it from their loan instead.' }
  if (existing.status === status) return { ok: true }

  const { error } = await admin.from('hardware_devices').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { ok: false, error: error.message }

  const from = STATUS_LABELS[existing.status as DeviceStatus] ?? existing.status
  const text = `${from} → ${STATUS_LABELS[status]}${note.trim() ? `\n${note.trim()}` : ''}`
  await admin.from('hardware_events').insert({ device_id: id, type: 'status_changed', notes: text, actor_id: staff.userId })
  return { ok: true }
}

export async function addHardwareNote(deviceId: string, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const text = note.trim()
  if (!text) return { ok: false, error: 'Write a note first.' }
  if (text.length > 4000) return { ok: false, error: 'Keep notes under 4,000 characters.' }

  const admin = createServiceSupabaseClient()
  const { data: device } = await admin.from('hardware_devices').select('id, current_holder_id').eq('id', deviceId).maybeSingle()
  if (!device) return { ok: false, error: 'Device not found.' }
  const { error } = await admin.from('hardware_events').insert({
    device_id: deviceId, student_id: device.current_holder_id, type: 'note', notes: text, actor_id: staff.userId,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Loans and returns (Phase 3a) ─────────────────────────────────────────────

const MAX_IDS = 50
const now = () => new Date().toISOString()

/** Students matching a name or email, for the "loan to" picker. */
export async function searchHardwareStudents(q: string): Promise<Result<{ students: Person[] }>> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const clean = sanitizeSearch(q)
  if (clean.length < 2) return { ok: true, students: [] }
  const admin = createServiceSupabaseClient()
  const { data, error } = await admin.from('users').select('id, name, email')
    .eq('role', 'student').or(`name.ilike.*${clean}*,email.ilike.*${clean}*`).order('name').limit(15)
  if (error) return { ok: false, error: error.message }
  return { ok: true, students: (data as Person[] | null) ?? [] }
}

/** Gives an in-stock device to a student. */
export async function loanHardwareDevice(deviceId: string, studentId: string, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: student } = await admin.from('users').select('id, role').eq('id', studentId).maybeSingle()
  if (!student || student.role !== 'student') return { ok: false, error: 'Choose a student.' }

  // Conditional update: only an in-stock device with no holder can be loaned, so two people
  // loaning the same device at once can't both succeed.
  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: 'on_loan', current_holder_id: studentId, updated_at: now() })
    .eq('id', deviceId).eq('status', 'in_stock').is('current_holder_id', null)
    .select('id, kind')
  if (error) return { ok: false, error: error.message }
  if (!updated?.length) return { ok: false, error: 'Only a device that is in stock can be loaned.' }

  await admin.from('hardware_events').insert({
    device_id: deviceId, student_id: studentId, type: 'loaned', notes: note.trim() || null, actor_id: staff.userId,
  })
  // If they were on the waitlist for this kind of device, they aren't any more.
  await admin.from('hardware_waitlist')
    .update({ fulfilled_at: now(), fulfilled_device_id: deviceId })
    .eq('student_id', studentId).eq('kind', updated[0].kind).is('fulfilled_at', null).is('removed_at', null)
  return { ok: true }
}

/** Starts chasing loaned devices back (e.g. the student dropped). Owned laptops are skipped. */
export async function markHardwareAwaitingReturn(deviceIds: string[], note: string): Promise<Result<{ marked: number }>> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const ids = [...new Set(deviceIds)].slice(0, MAX_IDS)
  if (ids.length === 0) return { ok: false, error: 'Choose at least one device.' }

  const admin = createServiceSupabaseClient()
  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: 'awaiting_return', updated_at: now() })
    .in('id', ids).eq('status', 'on_loan').not('current_holder_id', 'is', null)
    .select('id, current_holder_id')
  if (error) return { ok: false, error: error.message }
  const rows = (updated ?? []) as { id: string; current_holder_id: string }[]
  if (rows.length === 0) return { ok: false, error: 'None of those devices are on loan.' }

  const requestedAt = new Date()
  const firstReminder = new Date(requestedAt.getTime() + FIRST_RETURN_REMINDER_HOURS * 60 * 60 * 1000)
  await admin.from('hardware_return_requests').insert(rows.map(r => ({
    device_id: r.id, student_id: r.current_holder_id, requested_at: requestedAt.toISOString(),
    requested_by: staff.userId, next_reminder_at: firstReminder.toISOString(),
  })))
  await admin.from('hardware_events').insert(rows.map(r => ({
    device_id: r.id, student_id: r.current_holder_id, type: 'awaiting_return', notes: note.trim() || null, actor_id: staff.userId,
  })))
  return { ok: true, marked: rows.length }
}

/** Stops chasing a device (e.g. the student came back): it goes back to on loan. */
export async function cancelHardwareReturn(deviceId: string, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: 'on_loan', updated_at: now() })
    .eq('id', deviceId).eq('status', 'awaiting_return').select('id, current_holder_id')
  if (error) return { ok: false, error: error.message }
  if (!updated?.length) return { ok: false, error: 'This device is not awaiting return.' }

  await closeReturnRequests(admin, [deviceId], 'cancelled')
  await admin.from('hardware_events').insert({
    device_id: deviceId, student_id: updated[0].current_holder_id, type: 'return_cancelled', notes: note.trim() || null, actor_id: staff.userId,
  })
  return { ok: true }
}

/**
 * Records devices coming back from a student: clears the holder, closes any open return
 * request and sets the next status (needs prep / in stock / needs repair).
 */
export async function receiveHardwareDevices(
  deviceIds: string[],
  nextStatus: ReceiveStatus,
  conditionNotes: string,
): Promise<Result<{ received: number }>> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  if (!RECEIVE_STATUSES.includes(nextStatus)) return { ok: false, error: 'Choose what happens next.' }
  const ids = [...new Set(deviceIds)].slice(0, MAX_IDS)
  if (ids.length === 0) return { ok: false, error: 'Choose at least one device.' }

  const admin = createServiceSupabaseClient()
  const { data: before, error: readError } = await admin.from('hardware_devices')
    .select('id, current_holder_id').in('id', ids).not('current_holder_id', 'is', null)
  if (readError) return { ok: false, error: readError.message }
  const holders = new Map(((before ?? []) as { id: string; current_holder_id: string }[]).map(d => [d.id, d.current_holder_id]))
  if (holders.size === 0) return { ok: false, error: 'None of those devices are with a student.' }

  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: nextStatus, current_holder_id: null, updated_at: now() })
    .in('id', [...holders.keys()]).not('current_holder_id', 'is', null)
    .select('id')
  if (error) return { ok: false, error: error.message }
  const receivedIds = ((updated ?? []) as { id: string }[]).map(d => d.id)

  await closeReturnRequests(admin, receivedIds, 'received')
  const text = [`Next: ${STATUS_LABELS[nextStatus]}`, conditionNotes.trim()].filter(Boolean).join('\n')
  await admin.from('hardware_events').insert(receivedIds.map(id => ({
    device_id: id, student_id: holders.get(id) ?? null, type: 'received', notes: text, actor_id: staff.userId,
  })))
  return { ok: true, received: receivedIds.length }
}

/** One click from the Needs prep list: wiped and checked, back in stock. */
export async function markHardwarePrepped(deviceId: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: 'in_stock', updated_at: now() })
    .eq('id', deviceId).eq('status', 'needs_prep').is('current_holder_id', null).select('id')
  if (error) return { ok: false, error: error.message }
  if (!updated?.length) return { ok: false, error: 'This device is not waiting for prep.' }

  await admin.from('hardware_events').insert({ device_id: deviceId, type: 'prepped', actor_id: staff.userId })
  return { ok: true }
}

/** Confirms a device we were waiting on is not coming back. */
export async function confirmHardwareLost(deviceId: string, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: before } = await admin.from('hardware_devices').select('current_holder_id').eq('id', deviceId).maybeSingle()
  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: 'lost', current_holder_id: null, updated_at: now() })
    .eq('id', deviceId).eq('status', 'awaiting_return').select('id')
  if (error) return { ok: false, error: error.message }
  if (!updated?.length) return { ok: false, error: 'Only a device that is awaiting return can be marked lost here.' }

  await closeReturnRequests(admin, [deviceId], 'lost')
  await admin.from('hardware_events').insert({
    device_id: deviceId, student_id: before?.current_holder_id ?? null, type: 'marked_lost', notes: note.trim() || null, actor_id: staff.userId,
  })
  return { ok: true }
}

async function closeReturnRequests(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  deviceIds: string[],
  reason: 'received' | 'lost' | 'cancelled',
) {
  if (deviceIds.length === 0) return
  await admin.from('hardware_return_requests')
    .update({ closed_at: now(), closed_reason: reason, next_reminder_at: null })
    .in('device_id', deviceIds).is('closed_at', null)
}

// ── Ownership, replacements and waitlist (Phase 3b) ──────────────────────────

/** A loaned laptop becomes the student's. Staff decide; the Ready to transfer list only suggests. */
export async function transferHardwareOwnership(deviceId: string, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: updated, error } = await admin.from('hardware_devices')
    .update({ status: 'owned_by_student', updated_at: now() })
    .eq('id', deviceId).eq('kind', 'laptop').eq('status', 'on_loan').not('current_holder_id', 'is', null)
    .select('id, current_holder_id')
  if (error) return { ok: false, error: error.message }
  if (!updated?.length) return { ok: false, error: 'Only a laptop that is on loan can be transferred.' }

  await admin.from('hardware_events').insert({
    device_id: deviceId, student_id: updated[0].current_holder_id, type: 'ownership_transferred', notes: note.trim() || null, actor_id: staff.userId,
  })
  return { ok: true }
}

/**
 * Records a laptop or charger replacement. For a laptop: the new in-stock laptop goes to the
 * student (owned if the old one was owned), and the old one is either chased back or written
 * off. Each student gets one of each; more needs an override note.
 */
export async function recordHardwareReplacement(input: ReplacementInput): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  const { data: student } = await admin.from('users').select('id, role').eq('id', input.studentId).maybeSingle()
  if (!student || student.role !== 'student') return { ok: false, error: 'Choose a student.' }

  const { count } = await admin.from('hardware_replacements')
    .select('id', { count: 'exact', head: true }).eq('student_id', input.studentId).eq('kind', input.kind)
  const invalid = validateReplacementInput(input, count ?? 0)
  if (invalid) return { ok: false, error: invalid }

  let oldDevice: { id: string; status: string; kind: string; current_holder_id: string | null } | null = null
  if (input.oldDeviceId) {
    const { data } = await admin.from('hardware_devices').select('id, status, kind, current_holder_id').eq('id', input.oldDeviceId).maybeSingle()
    if (!data || data.kind !== 'laptop' || data.current_holder_id !== input.studentId) {
      return { ok: false, error: 'That laptop is not with this student.' }
    }
    oldDevice = data
  }

  if (input.kind === 'laptop') {
    if (!oldDevice || !['on_loan', 'owned_by_student'].includes(oldDevice.status)) {
      return { ok: false, error: 'Only a laptop the student has on loan or owns can be replaced.' }
    }
    const newStatus = oldDevice.status === 'owned_by_student' ? 'owned_by_student' : 'on_loan'
    const { data: sent, error: sendError } = await admin.from('hardware_devices')
      .update({ status: newStatus, current_holder_id: input.studentId, updated_at: now() })
      .eq('id', input.newDeviceId!).eq('kind', 'laptop').eq('status', 'in_stock').is('current_holder_id', null)
      .select('id')
    if (sendError) return { ok: false, error: sendError.message }
    if (!sent?.length) return { ok: false, error: 'The laptop to send must be in stock.' }

    if (input.oldComingBack) {
      await admin.from('hardware_devices').update({ status: 'awaiting_return', updated_at: now() }).eq('id', oldDevice.id)
      const requestedAt = new Date()
      await admin.from('hardware_return_requests').insert({
        device_id: oldDevice.id, student_id: input.studentId, requested_at: requestedAt.toISOString(), requested_by: staff.userId,
        next_reminder_at: new Date(requestedAt.getTime() + FIRST_RETURN_REMINDER_HOURS * 60 * 60 * 1000).toISOString(),
      })
    } else {
      await admin.from('hardware_devices')
        .update({ status: input.writeOff, current_holder_id: null, updated_at: now() }).eq('id', oldDevice.id)
    }
  }

  const { error } = await admin.from('hardware_replacements').insert({
    student_id: input.studentId,
    kind: input.kind,
    old_device_id: input.oldDeviceId,
    new_device_id: input.kind === 'laptop' ? input.newDeviceId : null,
    old_coming_back: input.oldComingBack,
    write_off_reason: input.oldComingBack ? null : input.writeOffReason.trim(),
    override_note: input.overrideNote.trim() || null,
    notes: input.notes.trim() || null,
    created_by: staff.userId,
  })
  if (error) return { ok: false, error: error.message }

  const detail = [
    input.oldComingBack ? 'Old one coming back' : `Old one not coming back: ${input.writeOffReason.trim()}`,
    input.overrideNote.trim() ? `Extra replacement allowed: ${input.overrideNote.trim()}` : '',
    input.notes.trim(),
  ].filter(Boolean).join('\n')
  const events = input.kind === 'laptop'
    ? [
        { device_id: input.oldDeviceId, student_id: input.studentId, type: input.oldComingBack ? 'replaced' : 'written_off', notes: detail, actor_id: staff.userId },
        { device_id: input.newDeviceId, student_id: input.studentId, type: 'replacement_sent', notes: null, actor_id: staff.userId },
      ]
    : [{ device_id: input.oldDeviceId, student_id: input.studentId, type: 'charger_replaced', notes: detail, actor_id: staff.userId }]
  await admin.from('hardware_events').insert(events)
  return { ok: true }
}

export async function addToHardwareWaitlist(studentId: string, kind: string, note: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  if (!DEVICE_KINDS.includes(kind as DeviceKind)) return { ok: false, error: 'Choose a device type.' }

  const admin = createServiceSupabaseClient()
  const { data: student } = await admin.from('users').select('id, role').eq('id', studentId).maybeSingle()
  if (!student || student.role !== 'student') return { ok: false, error: 'Choose a student.' }

  const { error } = await admin.from('hardware_waitlist').insert({
    student_id: studentId, kind, note: note.trim() || null, added_by: staff.userId,
  })
  if (error?.code === '23505') return { ok: false, error: 'This student is already waiting for one.' }
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function removeFromHardwareWaitlist(entryId: string): Promise<Result> {
  const staff = await requireHardwareStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()
  const { error } = await admin.from('hardware_waitlist')
    .update({ removed_at: now() }).eq('id', entryId).is('fulfilled_at', null).is('removed_at', null)
  return error ? { ok: false, error: error.message } : { ok: true }
}

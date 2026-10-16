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
  type BatchInput,
  type DeviceInput,
  type DeviceKind,
  type DeviceStatus,
  type HardwareDevice,
} from '@/lib/hardware'
import { DEVICE_COLUMNS } from '@/lib/hardware-server'

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

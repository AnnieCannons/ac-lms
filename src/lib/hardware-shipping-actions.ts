'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareActor } from '@/lib/hardware-access'
import { getResend } from '@/lib/resend'
import { notifyByEmail } from '@/lib/slack'
import { DEVICE_COLUMNS } from '@/lib/hardware-server'
import { blankToNull, type DeviceKind, type HardwareDevice } from '@/lib/hardware'
import {
  CARRIER_LABELS,
  LAPTOP_NEED_LABELS,
  SHIPPED_NOTIFICATION_TYPE,
  WIFI_LABELS,
  deviceKindsNeeded,
  isCarrier,
  isDateOnly,
  isLaptopNeed,
  isWifiChoice,
  normalizeTracking,
  parseCost,
  shippedMessage,
  validateInternetPlanInput,
  validateShipInput,
  wifiKindsNotNeeded,
  type Carrier,
  type InternetPlanInput,
  type ShipInput,
  type StudentNeeds,
} from '@/lib/hardware-shipping'
import { addNeededToWaitlist, loadNeeds, needsFor } from '@/lib/onboarding-server'
import { pacificToday } from '@/lib/hardware-reminders'

// Shipping, wifi/laptop choices and Comcast NOW plans (New Student Onboarding, phase 3).
// Every write uses the service client after a role check, like the rest of the tracker.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
type Admin = ReturnType<typeof createServiceSupabaseClient>

const blankOr = (s: string | null | undefined) => blankToNull(s ?? '')

const now = () => new Date().toISOString()
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com').replace(/\/$/, '')
const emailFrom = () => process.env.RESEND_FROM_EMAIL ?? 'AnnieCannons LMS <noreply@mail.anniecannons.com>'

/** Setup work (choices, plans): instructors, staff and admins. */
async function requireStaff(): Promise<{ userId: string } | null> {
  const actor = await getHardwareActor()
  return actor?.canManage ? { userId: actor.userId } : null
}

/** Day-to-day work (shipping, marking arrived): managers and TAs, like loans. */
async function requireUser(): Promise<{ userId: string } | null> {
  const actor = await getHardwareActor()
  return actor ? { userId: actor.userId } : null
}

async function isStudent(admin: Admin, id: string): Promise<{ id: string; name: string | null; email: string | null } | null> {
  const { data } = await admin.from('users').select('id, name, email, role').eq('id', id).maybeSingle()
  const row = data as { id: string; name: string | null; email: string | null; role: string } | null
  return row?.role === 'student' ? { id: row.id, name: row.name, email: row.email } : null
}

function refresh(studentId: string) {
  revalidatePath(`/instructor/hardware/students/${studentId}`)
  revalidatePath('/instructor/onboarding', 'layout')
}

/** Whether the student's Enrollment Readiness finish steps have run (so they're due their equipment). */
async function hasFinishedOnboarding(admin: Admin, studentId: string): Promise<boolean> {
  const { data } = await admin.from('hardware_alerts_sent').select('key').like('key', `onboarding-finished:%:${studentId}`).limit(1)
  return (data ?? []).length > 0
}

// ── Laptop and wifi choices ──────────────────────────────────────────────────

/**
 * Sets what the student needs. Open waitlist entries that no longer fit are dropped; once the
 * student has finished Enrollment Readiness, anything newly needed joins the waitlist.
 */
export async function setStudentNeeds(studentId: string, change: Partial<StudentNeeds>): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  if (change.laptop !== undefined && !isLaptopNeed(change.laptop)) return { ok: false, error: 'Choose whether they need a laptop.' }
  if (change.wifi !== undefined && !isWifiChoice(change.wifi)) return { ok: false, error: 'Choose a wifi option.' }

  const admin = createServiceSupabaseClient()
  if (!(await isStudent(admin, studentId))) return { ok: false, error: 'Choose a student.' }

  const before = needsFor(await loadNeeds(admin, [studentId]), studentId)
  const next: StudentNeeds = { laptop: change.laptop ?? before.laptop, wifi: change.wifi ?? before.wifi }
  if (next.laptop === before.laptop && next.wifi === before.wifi) return { ok: true }

  const { error } = await admin.from('hardware_student_needs').upsert(
    { student_id: studentId, laptop: next.laptop, wifi: next.wifi, updated_by: staff.userId, updated_at: now() },
    { onConflict: 'student_id' },
  )
  if (error) return { ok: false, error: error.message }

  const notes = [
    next.laptop !== before.laptop && `Laptop: ${LAPTOP_NEED_LABELS[next.laptop]}`,
    next.wifi !== before.wifi && `Wifi: ${WIFI_LABELS[next.wifi]}`,
  ].filter(Boolean).join(' · ')
  await admin.from('hardware_events').insert({ student_id: studentId, type: 'needs_updated', notes, actor_id: staff.userId })

  // Drop waiting entries the new choice rules out.
  const notNeeded: DeviceKind[] = [...wifiKindsNotNeeded(next.wifi), ...(next.laptop === 'own' ? ['laptop' as const] : [])]
  const stillNeeded = new Set(deviceKindsNeeded(next))
  const drop = notNeeded.filter(k => !stillNeeded.has(k))
  if (drop.length) {
    await admin.from('hardware_waitlist').update({ removed_at: now() })
      .eq('student_id', studentId).in('kind', drop).is('fulfilled_at', null).is('removed_at', null)
  }
  if (await hasFinishedOnboarding(admin, studentId)) {
    await addNeededToWaitlist(admin, studentId, next, 'Finished Enrollment Readiness', staff.userId)
  }
  refresh(studentId)
  return { ok: true }
}

// ── Shipping ─────────────────────────────────────────────────────────────────

/**
 * Loans the chosen in-stock devices (and/or includes ones the student already has), records
 * the box with its tracking number, and tells the student by bell, Slack DM and email.
 */
export async function shipToStudent(input: ShipInput): Promise<Result<{ shipmentId: string }>> {
  const actor = await requireUser()
  if (!actor) return { ok: false, error: 'Not authorized.' }
  const clean: ShipInput = {
    ...input,
    loanDeviceIds: [...new Set(input.loanDeviceIds.filter(Boolean))],
    heldDeviceIds: [...new Set(input.heldDeviceIds.filter(Boolean))],
    trackingNumber: normalizeTracking(input.trackingNumber ?? ''),
  }
  const invalid = validateShipInput(clean)
  if (invalid) return { ok: false, error: invalid }

  const admin = createServiceSupabaseClient()
  const student = await isStudent(admin, clean.studentId)
  if (!student) return { ok: false, error: 'Choose a student.' }

  const ids = [...clean.loanDeviceIds, ...clean.heldDeviceIds]
  const { data: rows } = await admin.from('hardware_devices').select(DEVICE_COLUMNS).in('id', ids)
  const devices = new Map(((rows ?? []) as HardwareDevice[]).map(d => [d.id, d]))
  for (const id of clean.loanDeviceIds) {
    const d = devices.get(id)
    if (!d || d.status !== 'in_stock' || d.current_holder_id) return { ok: false, error: `${d?.asset_tag ?? 'A device'} isn't in stock any more.` }
  }
  for (const id of clean.heldDeviceIds) {
    if (devices.get(id)?.current_holder_id !== student.id) return { ok: false, error: 'One of the devices isn’t with this student.' }
  }

  // Loan each in-stock device. Conditional, so two people shipping the same device can't both succeed.
  const loaned: string[] = []
  for (const id of clean.loanDeviceIds) {
    const { data: updated, error } = await admin.from('hardware_devices')
      .update({ status: 'on_loan', current_holder_id: student.id, updated_at: now() })
      .eq('id', id).eq('status', 'in_stock').is('current_holder_id', null).select('id, kind')
    if (error || !updated?.length) {
      const tag = devices.get(id)?.asset_tag ?? 'A device'
      const done = loaned.map(l => devices.get(l)?.asset_tag).filter(Boolean).join(', ')
      return { ok: false, error: `${tag} couldn't be loaned${error ? `: ${error.message}` : ' (no longer in stock)'}.${done ? ` Already loaned: ${done}.` : ''}` }
    }
    loaned.push(id)
    await admin.from('hardware_events').insert({ device_id: id, student_id: student.id, type: 'loaned', notes: 'Shipped', actor_id: actor.userId })
    await admin.from('hardware_waitlist')
      .update({ fulfilled_at: now(), fulfilled_device_id: id })
      .eq('student_id', student.id).eq('kind', (updated[0] as { kind: string }).kind).is('fulfilled_at', null).is('removed_at', null)
  }

  const { data: shipment, error: shipError } = await admin.from('hardware_shipments').insert({
    student_id: student.id,
    device_ids: ids,
    carrier: clean.carrier,
    tracking_number: clean.trackingNumber,
    shipped_on: clean.shippedOn,
    notes: blankOr(clean.notes),
    created_by: actor.userId,
  }).select('id').single()
  if (shipError || !shipment) return { ok: false, error: shipError?.message ?? 'The shipment could not be saved.' }

  const label = `${CARRIER_LABELS[clean.carrier]} ${clean.trackingNumber}`
  await admin.from('hardware_events').insert(ids.map(id => ({ device_id: id, student_id: student.id, type: 'shipped', notes: label, actor_id: actor.userId })))

  const kinds = ids.map(id => devices.get(id)?.kind).filter((k): k is DeviceKind => !!k)
  const message = shippedMessage(student.name, kinds, clean.carrier, clean.trackingNumber, `${appUrl()}/account#equipment`)
  await admin.from('notifications').insert({ user_id: student.id, type: SHIPPED_NOTIFICATION_TYPE, message: message.bell })
  if (student.email) {
    const email = student.email
    after(async () => {
      await notifyByEmail(email, message.text).catch(() => false)
      try {
        await getResend().emails.send({ from: emailFrom(), to: email, subject: message.subject, text: message.text })
      } catch (e) {
        console.error(`shipping: email to ${email} failed`, e)
      }
    })
  }
  refresh(student.id)
  return { ok: true, shipmentId: (shipment as { id: string }).id }
}

/** Fixes a typo in a shipment's carrier, tracking number, date or note. Staff only. */
export async function updateShipment(shipmentId: string, change: { carrier: Carrier; trackingNumber: string; shippedOn: string; notes: string }): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  if (!isCarrier(change.carrier)) return { ok: false, error: 'Choose a carrier.' }
  const tracking = normalizeTracking(change.trackingNumber ?? '')
  if (!tracking) return { ok: false, error: 'Add the tracking number.' }
  if (!isDateOnly(change.shippedOn)) return { ok: false, error: 'Choose the date it shipped.' }
  const admin = createServiceSupabaseClient()
  const { data, error } = await admin.from('hardware_shipments')
    .update({ carrier: change.carrier, tracking_number: tracking, shipped_on: change.shippedOn, notes: blankOr(change.notes) })
    .eq('id', shipmentId).select('student_id')
  if (error) return { ok: false, error: error.message }
  const row = (data ?? [])[0] as { student_id: string } | undefined
  if (!row) return { ok: false, error: 'Shipment not found.' }
  refresh(row.student_id)
  return { ok: true }
}

async function markArrived(admin: Admin, shipmentId: string, by: string, note: string, onlyFor?: string): Promise<Result> {
  const { data: rows } = await admin.from('hardware_shipments').select('id, student_id, device_ids, received_at').eq('id', shipmentId)
  const shipment = (rows ?? [])[0] as { id: string; student_id: string; device_ids: string[]; received_at: string | null } | undefined
  if (!shipment || (onlyFor && shipment.student_id !== onlyFor)) return { ok: false, error: 'Shipment not found.' }
  if (shipment.received_at) return { ok: true }
  const { error } = await admin.from('hardware_shipments').update({ received_at: now(), received_by: by }).eq('id', shipmentId).is('received_at', null)
  if (error) return { ok: false, error: error.message }
  if (shipment.device_ids.length) {
    await admin.from('hardware_events').insert(shipment.device_ids.map(id => ({ device_id: id, student_id: shipment.student_id, type: 'arrived', notes: note, actor_id: by })))
  }
  refresh(shipment.student_id)
  return { ok: true }
}

/** Staff: the box arrived (the student told us another way). */
export async function markShipmentArrived(shipmentId: string): Promise<Result> {
  const actor = await requireUser()
  if (!actor) return { ok: false, error: 'Not authorized.' }
  return markArrived(createServiceSupabaseClient(), shipmentId, actor.userId, 'Marked arrived by staff')
}

/** Student: "I got it" on My Equipment. Only for their own shipments. */
export async function confirmMyShipment(shipmentId: string): Promise<Result> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  const result = await markArrived(createServiceSupabaseClient(), shipmentId, user.id, 'Student confirmed it arrived', user.id)
  if (result.ok) {
    revalidatePath('/account')
    revalidatePath('/student/courses', 'layout')
  }
  return result
}

// ── Comcast NOW plans ────────────────────────────────────────────────────────

/** Adds a plan (planId null) or edits one. Staff only. */
export async function saveInternetPlan(studentId: string, planId: string | null, input: InternetPlanInput): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const invalid = validateInternetPlanInput(input)
  if (invalid) return { ok: false, error: invalid }
  const admin = createServiceSupabaseClient()
  if (!(await isStudent(admin, studentId))) return { ok: false, error: 'Choose a student.' }

  const row = {
    account_number: blankOr(input.accountNumber),
    monthly_cost: parseCost(input.monthlyCost),
    starts_on: input.startsOn,
    ends_on: blankOr(input.endsOn),
    notes: blankOr(input.notes),
    updated_at: now(),
  }
  if (planId) {
    const { data, error } = await admin.from('hardware_internet_plans').update(row).eq('id', planId).eq('student_id', studentId).select('id')
    if (error) return { ok: false, error: error.message }
    if (!data?.length) return { ok: false, error: 'Plan not found.' }
  } else {
    const { error } = await admin.from('hardware_internet_plans').insert({ ...row, student_id: studentId, created_by: staff.userId })
    if (error) return { ok: false, error: error.message }
  }
  await admin.from('hardware_events').insert({
    student_id: studentId, type: planId ? 'internet_plan_edited' : 'internet_plan_added',
    notes: `Comcast NOW from ${input.startsOn}${row.ends_on ? ` to ${row.ends_on}` : ''}`, actor_id: staff.userId,
  })
  refresh(studentId)
  return { ok: true }
}

/** Ends a plan today (or on the given date). Staff only. */
export async function endInternetPlan(planId: string, endsOn?: string): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const end = endsOn && isDateOnly(endsOn) ? endsOn : pacificToday()
  const admin = createServiceSupabaseClient()
  const { data: rows } = await admin.from('hardware_internet_plans').select('id, student_id, starts_on').eq('id', planId)
  const plan = (rows ?? [])[0] as { id: string; student_id: string; starts_on: string } | undefined
  if (!plan) return { ok: false, error: 'Plan not found.' }
  const { error } = await admin.from('hardware_internet_plans').update({ ends_on: end < plan.starts_on ? plan.starts_on : end, updated_at: now() }).eq('id', planId)
  if (error) return { ok: false, error: error.message }
  await admin.from('hardware_events').insert({ student_id: plan.student_id, type: 'internet_plan_ended', notes: `Comcast NOW ended ${end}`, actor_id: staff.userId })
  refresh(plan.student_id)
  return { ok: true }
}

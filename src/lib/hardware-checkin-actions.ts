'use server'

import { after } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { notifyByEmail } from '@/lib/slack'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { HARDWARE_ROLES } from '@/lib/hardware-access'
import { blankToNull } from '@/lib/hardware'
import {
  CHECKIN_NOTIFICATION_TYPE,
  CHECKIN_PATH,
  planCheckin,
  validateCheckinInput,
  type CheckinInput,
  type CheckinResponse,
  type DeviceMatch,
} from '@/lib/hardware-checkin'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
type Admin = ReturnType<typeof createServiceSupabaseClient>

const now = () => new Date().toISOString()
const CHECKIN_MESSAGE = 'Please fill out the AnnieCannons equipment check-in. It takes about 2 minutes.'
const MATCH_COLUMNS = 'id, asset_tag, kind, status, current_holder_id, serial_number, imei, phone_number'

async function signedIn(): Promise<{ userId: string; role: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return { userId: user.id, role: profile?.role ?? '' }
}

/** Instructors, staff and admins run check-ins. TAs and students may not. */
async function requireStaff() {
  const me = await signedIn()
  return me && HARDWARE_ROLES.includes(me.role) ? me : null
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com'

/**
 * Bell notification now, plus a Slack DM (matched by email) sent in the background after the
 * response, a few at a time. A student without a Slack match still gets the bell.
 */
async function notify(admin: Admin, userIds: string[], reminder = false) {
  if (userIds.length === 0) return
  await admin.from('notifications').insert(userIds.map(user_id => ({ user_id, type: CHECKIN_NOTIFICATION_TYPE, message: CHECKIN_MESSAGE })))

  const { data } = await admin.from('users').select('email').in('id', userIds)
  const emails = ((data ?? []) as { email: string | null }[]).map(u => u.email).filter((e): e is string => !!e)
  const text = `${reminder ? '⏰ *Reminder:* please' : '💻 Please'} fill out the AnnieCannons *equipment check-in*. It takes about 2 minutes: ${appUrl()}${CHECKIN_PATH}`
  after(async () => {
    for (let i = 0; i < emails.length; i += 5) {
      await Promise.all(emails.slice(i, i + 5).map(email => notifyByEmail(email, text).catch(() => false)))
    }
  })
}

/** Adds students and TAs (from courses and/or picked one by one) to a check-in and notifies the new ones. */
async function addRecipients(admin: Admin, surveyId: string, courseIds: string[], personIds: string[]): Promise<number> {
  const rows = new Map<string, string | null>()
  const courses = [...new Set(courseIds)].slice(0, 50)
  if (courses.length) {
    const enrolled = await fetchAllRows<{ user_id: string; course_id: string }>((from, to) =>
      admin.from('course_enrollments').select('user_id, course_id').in('course_id', courses).in('role', ['student', 'ta']).range(from, to) as unknown as PromiseLike<{ data: { user_id: string; course_id: string }[] | null; error: { message: string } | null }>)
    for (const e of enrolled) if (!rows.has(e.user_id)) rows.set(e.user_id, e.course_id)
  }
  const people = [...new Set(personIds)].slice(0, 200)
  if (people.length) {
    const { data } = await admin.from('users').select('id').in('id', people).eq('role', 'student')
    for (const p of (data ?? []) as { id: string }[]) if (!rows.has(p.id)) rows.set(p.id, null)
  }
  if (rows.size === 0) return 0

  const { data: existing } = await admin.from('hardware_survey_recipients').select('user_id').eq('survey_id', surveyId)
  const already = new Set(((existing ?? []) as { user_id: string }[]).map(r => r.user_id))
  const fresh = [...rows.entries()].filter(([id]) => !already.has(id))
  if (fresh.length === 0) return 0
  const { error } = await admin.from('hardware_survey_recipients')
    .insert(fresh.map(([user_id, course_id]) => ({ survey_id: surveyId, user_id, course_id })))
  if (error) throw new Error(error.message)
  await notify(admin, fresh.map(([id]) => id))
  return fresh.length
}

export async function createHardwareCheckin(input: { title: string; courseIds: string[]; personIds: string[] }): Promise<Result<{ id: string; sent: number }>> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const title = input.title.trim()
  if (!title) return { ok: false, error: 'Give the check-in a name.' }
  if (input.courseIds.length === 0 && input.personIds.length === 0) return { ok: false, error: 'Choose at least one course or person.' }

  const admin = createServiceSupabaseClient()
  const { data: survey, error } = await admin.from('hardware_surveys').insert({ title, created_by: staff.userId }).select('id').single()
  if (error || !survey) return { ok: false, error: error?.message ?? 'Could not create the check-in.' }
  try {
    const sent = await addRecipients(admin, survey.id, input.courseIds, input.personIds)
    if (sent === 0) {
      await admin.from('hardware_surveys').delete().eq('id', survey.id)
      return { ok: false, error: 'Those courses have no students in them.' }
    }
    return { ok: true, id: survey.id, sent }
  } catch (e) {
    await admin.from('hardware_surveys').delete().eq('id', survey.id)
    return { ok: false, error: e instanceof Error ? e.message : 'Could not send the check-in.' }
  }
}

export async function addHardwareCheckinRecipients(surveyId: string, courseIds: string[], personIds: string[]): Promise<Result<{ added: number }>> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()
  const { data: survey } = await admin.from('hardware_surveys').select('closed_at').eq('id', surveyId).maybeSingle()
  if (!survey) return { ok: false, error: 'Check-in not found.' }
  if (survey.closed_at) return { ok: false, error: 'This check-in is closed.' }
  try {
    return { ok: true, added: await addRecipients(admin, surveyId, courseIds, personIds) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not add them.' }
  }
}

/** Sends the bell reminder again to everyone given (or everyone who hasn't answered). */
export async function nudgeHardwareCheckin(surveyId: string, userIds?: string[]): Promise<Result<{ nudged: number }>> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()
  const [{ data: recipients }, { data: responses }] = await Promise.all([
    admin.from('hardware_survey_recipients').select('user_id').eq('survey_id', surveyId),
    admin.from('hardware_survey_responses').select('user_id').eq('survey_id', surveyId),
  ])
  const answered = new Set(((responses ?? []) as { user_id: string }[]).map(r => r.user_id))
  let targets = ((recipients ?? []) as { user_id: string }[]).map(r => r.user_id).filter(id => !answered.has(id))
  if (userIds) targets = targets.filter(id => userIds.includes(id))
  if (targets.length === 0) return { ok: true, nudged: 0 }
  await notify(admin, targets, true)
  await admin.from('hardware_survey_recipients').update({ last_nudged_at: now() }).eq('survey_id', surveyId).in('user_id', targets)
  return { ok: true, nudged: targets.length }
}

export async function setHardwareCheckinClosed(surveyId: string, closed: boolean): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const { error } = await createServiceSupabaseClient().from('hardware_surveys').update({ closed_at: closed ? now() : null }).eq('id', surveyId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

async function loadMatches(admin: Admin): Promise<DeviceMatch[]> {
  return fetchAllRows<DeviceMatch>((from, to) =>
    admin.from('hardware_devices').select(MATCH_COLUMNS).range(from, to) as unknown as PromiseLike<{ data: DeviceMatch[] | null; error: { message: string } | null }>)
}

export type ApproveChoices = { laptop: boolean; hotspot: boolean; booster: boolean; replacements: boolean; laptopOwned: boolean }

/**
 * Applies a reviewed response: creates or links the devices the student says they have and
 * records past replacements. The plan is worked out again here, never trusted from the
 * browser; anything in conflict is skipped.
 */
export async function approveHardwareCheckinResponse(responseId: string, choices: ApproveChoices): Promise<Result<{ done: string[] }>> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()

  const { data: row } = await admin.from('hardware_survey_responses').select('*').eq('id', responseId).maybeSingle()
  const r = row as CheckinResponse | null
  if (!r) return { ok: false, error: 'Response not found.' }
  if (r.review_status !== 'pending') return { ok: false, error: 'This response was already reviewed.' }

  const [devices, { data: reps }] = await Promise.all([
    loadMatches(admin),
    admin.from('hardware_replacements').select('kind').eq('student_id', r.user_id),
  ])
  const kinds = ((reps ?? []) as { kind: string }[]).map(x => x.kind)
  const plan = planCheckin(r, devices, { laptop: kinds.filter(k => k === 'laptop').length, charger: kinds.filter(k => k === 'charger').length })
  const done: string[] = []
  const note = 'From the equipment check-in'

  async function give(kind: 'laptop' | 'hotspot' | 'booster', step: typeof plan.laptop, fields: Record<string, string | null>, owned: boolean) {
    const status = owned ? 'owned_by_student' : 'on_loan'
    if (step.action === 'create') {
      const { data: created, error } = await admin.from('hardware_devices')
        .insert({ kind, status, current_holder_id: r!.user_id, created_by: staff!.userId, ...fields }).select('id, asset_tag').single()
      if (error || !created) throw new Error(error?.message ?? `Could not add the ${kind}.`)
      await admin.from('hardware_events').insert([
        { device_id: created.id, type: 'added', notes: note, actor_id: staff!.userId },
        { device_id: created.id, student_id: r!.user_id, type: owned ? 'ownership_transferred' : 'loaned', notes: note, actor_id: staff!.userId },
      ])
      done.push(`Added ${created.asset_tag}`)
    } else if (step.action === 'link') {
      const { data: linked } = await admin.from('hardware_devices')
        .update({ status, current_holder_id: r!.user_id, updated_at: now() })
        .eq('id', step.device.id).is('current_holder_id', null).select('id')
      if (!linked?.length) throw new Error(`${step.device.asset_tag} was just given to someone else.`)
      await admin.from('hardware_events').insert({
        device_id: step.device.id, student_id: r!.user_id, type: owned ? 'ownership_transferred' : 'loaned', notes: note, actor_id: staff!.userId,
      })
      done.push(`Linked ${step.device.asset_tag}`)
    }
  }

  try {
    if (choices.laptop) await give('laptop', plan.laptop, { serial_number: blankToNull(r.laptop_serial ?? '') }, choices.laptopOwned)
    if (choices.hotspot) await give('hotspot', plan.hotspot, { imei: blankToNull(r.hotspot_imei ?? ''), phone_number: blankToNull(r.hotspot_phone ?? '') }, false)
    if (choices.booster) await give('booster', plan.booster, {}, false)
    if (choices.replacements) {
      const past = [
        ...(plan.laptopReplacement ? ['laptop' as const] : []),
        ...(plan.chargerReplacement ? ['charger' as const] : []),
      ]
      if (past.length) {
        const text = 'Replaced before the tracker (from the equipment check-in)'
        await admin.from('hardware_replacements').insert(past.map(kind => ({
          student_id: r.user_id, kind, old_coming_back: true, notes: text, created_by: staff.userId,
        })))
        await admin.from('hardware_events').insert(past.map(kind => ({
          student_id: r.user_id, type: kind === 'laptop' ? 'replaced' : 'charger_replaced', notes: text, actor_id: staff.userId,
        })))
        done.push(`Recorded past ${past.join(' and ')} replacement${past.length > 1 ? 's' : ''}`)
      }
    }
  } catch (e) {
    return { ok: false, error: `${e instanceof Error ? e.message : 'Something went wrong.'}${done.length ? ` (Already done: ${done.join(', ')}.)` : ''}` }
  }

  await admin.from('hardware_survey_responses').update({
    review_status: 'approved', reviewed_at: now(), reviewed_by: staff.userId, review_note: done.join('; ') || 'Nothing to add',
  }).eq('id', responseId)
  return { ok: true, done }
}

export async function dismissHardwareCheckinResponse(responseId: string, note: string): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const { error } = await createServiceSupabaseClient().from('hardware_survey_responses').update({
    review_status: 'dismissed', reviewed_at: now(), reviewed_by: staff.userId, review_note: note.trim() || null,
  }).eq('id', responseId).eq('review_status', 'pending')
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Puts a reviewed response back to "to review" (devices already added are not undone). */
export async function reopenHardwareCheckinResponse(responseId: string): Promise<Result> {
  const staff = await requireStaff()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const { error } = await createServiceSupabaseClient().from('hardware_survey_responses')
    .update({ review_status: 'pending', reviewed_at: null, reviewed_by: null, review_note: null }).eq('id', responseId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Student side ─────────────────────────────────────────────────────────────

/** A student's own answers. Only for a check-in they were sent, that's open, and not yet reviewed. */
export async function submitMyHardwareCheckin(surveyId: string, input: CheckinInput): Promise<Result> {
  const me = await signedIn()
  if (!me) return { ok: false, error: 'Please log in again.' }
  const invalid = validateCheckinInput(input)
  if (invalid) return { ok: false, error: invalid }

  const admin = createServiceSupabaseClient()
  const [{ data: recipient }, { data: survey }, { data: existing }] = await Promise.all([
    admin.from('hardware_survey_recipients').select('user_id').eq('survey_id', surveyId).eq('user_id', me.userId).maybeSingle(),
    admin.from('hardware_surveys').select('closed_at').eq('id', surveyId).maybeSingle(),
    admin.from('hardware_survey_responses').select('review_status').eq('survey_id', surveyId).eq('user_id', me.userId).maybeSingle(),
  ])
  if (!recipient || !survey) return { ok: false, error: "This check-in isn't for you." }
  if (survey.closed_at) return { ok: false, error: 'This check-in is closed. Reach out to Catie if something changed.' }
  if (existing && existing.review_status !== 'pending') {
    return { ok: false, error: "We've already recorded your answers. Reach out to Catie if something changed." }
  }

  const row = {
    survey_id: surveyId,
    user_id: me.userId,
    has_laptop: input.hasLaptop,
    laptop_serial: input.hasLaptop ? blankToNull(input.laptopSerial) : null,
    has_hotspot: input.hasHotspot,
    hotspot_imei: input.hasHotspot ? blankToNull(input.hotspotImei) : null,
    hotspot_phone: input.hasHotspot ? blankToNull(input.hotspotPhone) : null,
    has_booster: input.hasBooster,
    laptop_replaced: input.laptopReplaced,
    charger_replaced: input.chargerReplaced,
    notes: blankToNull(input.notes),
    updated_at: now(),
  }
  const { error } = await admin.from('hardware_survey_responses').upsert(row, { onConflict: 'survey_id,user_id' })
  if (error) return { ok: false, error: error.message }

  // The bell reminders have done their job.
  await admin.from('notifications').update({ read: true, cleared_at: now() })
    .eq('user_id', me.userId).eq('type', CHECKIN_NOTIFICATION_TYPE).is('cleared_at', null)
  return { ok: true }
}

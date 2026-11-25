import { after } from 'next/server'
import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { slackEscape, slackPostMessage } from '@/lib/slack'
import { HARDWARE_SLACK_CHANNEL_DEFAULT, pacificToday } from '@/lib/hardware-reminders'
import { DEVICE_COLUMNS } from '@/lib/hardware-server'
import type { DeviceKind, HardwareDevice } from '@/lib/hardware'
import {
  describeNeeds,
  onboardingFinishedKey,
  onboardingProgress,
  type OnboardingAssignment,
  type OnboardingOverride,
  type OnboardingProgress,
  type OnboardingSubmission,
} from '@/lib/onboarding'
import {
  DEFAULT_NEEDS,
  deviceKindsNeeded,
  inTransit,
  isLaptopNeed,
  isPlanCurrent,
  PLAN_COLUMNS,
  SHIPMENT_COLUMNS,
  isWifiChoice,
  pendingEquipment,
  type InternetPlan,
  type PendingItem,
  type Shipment,
  type StudentNeeds,
} from '@/lib/hardware-shipping'

// Server-only loaders for New Student Onboarding. Callers check access first and pass in
// a service-role client. See _plans/new-student-onboarding-roadmap.md.

type Admin = ReturnType<typeof createServiceSupabaseClient>

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com').replace(/\/$/, '')
const hardwareChannel = () => process.env.SLACK_HARDWARE_CHANNEL || HARDWARE_SLACK_CHANNEL_DEFAULT
const IN_CHUNK = 200

function chunks<T>(list: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export type CohortCourse = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  onboarding_next_course_id: string | null
}

export type Person = { id: string; name: string | null; email: string }

export async function isEnrollmentReadinessCourse(admin: Admin, courseId: string): Promise<boolean> {
  const { data } = await admin.from('courses').select('is_enrollment_readiness').eq('id', courseId).maybeSingle()
  return !!(data as { is_enrollment_readiness?: boolean } | null)?.is_enrollment_readiness
}

/** Every Enrollment Readiness course (not templates or archived ones). */
export async function loadCohorts(admin: Admin): Promise<CohortCourse[]> {
  const { data } = await admin.from('courses')
    .select('id, name, start_date, end_date, onboarding_next_course_id, is_template, archived')
    .eq('is_enrollment_readiness', true)
  return ((data ?? []) as (CohortCourse & { is_template: boolean | null; archived: boolean | null })[])
    .filter(c => !c.is_template && !c.archived)
    .map(({ id, name, start_date, end_date, onboarding_next_course_id }) => ({ id, name, start_date, end_date, onboarding_next_course_id }))
}

/**
 * The course's published assignments in outline order (module, day, assignment), from
 * published modules only, since students never see the rest.
 */
export async function loadOnboardingAssignments(admin: Admin, courseId: string): Promise<OnboardingAssignment[]> {
  const { data: modules } = await admin.from('modules')
    .select('id, title, order, published').eq('course_id', courseId).is('deleted_at', null)
  const visible = ((modules ?? []) as { id: string; title: string | null; order: number | null; published: boolean | null }[])
    .filter(m => m.published === true && !/DO NOT PUBLISH/i.test(m.title ?? ''))
  if (visible.length === 0) return []
  const moduleOrder = new Map(visible.map(m => [m.id, m.order ?? 0]))

  const { data: days } = await admin.from('module_days')
    .select('id, module_id, order').in('module_id', visible.map(m => m.id)).is('deleted_at', null)
  const dayRows = (days ?? []) as { id: string; module_id: string; order: number | null }[]
  if (dayRows.length === 0) return []
  const dayById = new Map(dayRows.map(d => [d.id, d]))

  const rows: (OnboardingAssignment & { order: number | null; module_day_id: string })[] = []
  for (const part of chunks(dayRows.map(d => d.id))) {
    const { data } = await admin.from('assignments')
      .select('id, title, due_date, submission_required, counts_toward_onboarding, is_optional, is_bonus, order, module_day_id')
      .in('module_day_id', part).eq('published', true).is('deleted_at', null)
    rows.push(...((data ?? []) as typeof rows))
  }
  const key = (a: (typeof rows)[number]) => {
    const day = dayById.get(a.module_day_id)
    return [moduleOrder.get(day?.module_id ?? '') ?? 0, day?.order ?? 0, a.order ?? 0]
  }
  return rows
    .sort((a, b) => {
      const ka = key(a), kb = key(b)
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || a.title.localeCompare(b.title)
    })
    .map(({ id, title, due_date, submission_required, counts_toward_onboarding, is_optional, is_bonus }) =>
      ({ id, title, due_date, submission_required, counts_toward_onboarding, is_optional, is_bonus }))
}

type SubmissionRow = OnboardingSubmission & { student_id: string }
type OverrideRow = OnboardingOverride & { assignment_id: string; student_id: string }

async function loadSubmissions(admin: Admin, assignmentIds: string[], studentIds?: string[]): Promise<SubmissionRow[]> {
  const out: SubmissionRow[] = []
  for (const part of chunks(assignmentIds)) {
    out.push(...await fetchAllRows<SubmissionRow>((from, to) => {
      let q = admin.from('submissions').select('id, assignment_id, student_id, status, grade').in('assignment_id', part)
      if (studentIds && studentIds.length <= IN_CHUNK) q = q.in('student_id', studentIds)
      return q.order('id').range(from, to) as unknown as PromiseLike<{ data: SubmissionRow[] | null; error: { message: string } | null }>
    }))
  }
  if (!studentIds) return out
  const wanted = new Set(studentIds)
  return out.filter(s => wanted.has(s.student_id))
}

async function loadOverrides(admin: Admin, assignmentIds: string[], studentIds?: string[]): Promise<OverrideRow[]> {
  const out: OverrideRow[] = []
  for (const part of chunks(assignmentIds)) {
    out.push(...await fetchAllRows<OverrideRow>((from, to) => {
      let q = admin.from('assignment_overrides').select('assignment_id, student_id, due_date, excused').in('assignment_id', part)
      if (studentIds && studentIds.length <= IN_CHUNK) q = q.in('student_id', studentIds)
      return q.order('id').range(from, to) as unknown as PromiseLike<{ data: OverrideRow[] | null; error: { message: string } | null }>
    }))
  }
  if (!studentIds) return out
  const wanted = new Set(studentIds)
  return out.filter(o => wanted.has(o.student_id))
}

/** Progress for each of `studentIds` through the course. `today` is YYYY-MM-DD (Pacific). */
export async function loadCohortProgress(
  admin: Admin,
  courseId: string,
  studentIds: string[],
  today: string = pacificToday(),
  assignments?: OnboardingAssignment[],
): Promise<{ assignments: OnboardingAssignment[]; progress: Map<string, OnboardingProgress> }> {
  const list = assignments ?? await loadOnboardingAssignments(admin, courseId)
  const ids = list.map(a => a.id)
  const [subs, overrides] = ids.length && studentIds.length
    ? await Promise.all([loadSubmissions(admin, ids, studentIds), loadOverrides(admin, ids, studentIds)])
    : [[], []]
  const progress = new Map<string, OnboardingProgress>()
  for (const studentId of studentIds) {
    const subMap = new Map(subs.filter(s => s.student_id === studentId).map(s => [s.assignment_id, s]))
    const overrideMap = new Map(overrides.filter(o => o.student_id === studentId).map(o => [o.assignment_id, { due_date: o.due_date, excused: o.excused }]))
    progress.set(studentId, onboardingProgress(list, subMap, overrideMap, today))
  }
  return { assignments: list, progress }
}

export async function loadStudentProgress(admin: Admin, courseId: string, studentId: string, today: string = pacificToday()): Promise<OnboardingProgress> {
  const { progress } = await loadCohortProgress(admin, courseId, [studentId], today)
  return progress.get(studentId)!
}

/** Students enrolled as students, by name. */
export async function loadCohortStudents(admin: Admin, courseId: string): Promise<Person[]> {
  const enrollments = await fetchAllRows<{ user_id: string }>((from, to) =>
    admin.from('course_enrollments').select('user_id').eq('course_id', courseId).eq('role', 'student').order('user_id').range(from, to) as unknown as PromiseLike<{ data: { user_id: string }[] | null; error: { message: string } | null }>)
  const ids = enrollments.map(e => e.user_id)
  const people: Person[] = []
  for (const part of chunks(ids)) {
    const { data } = await admin.from('users').select('id, name, email').in('id', part)
    people.push(...((data ?? []) as Person[]))
  }
  return people.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
}

export type PendingInvite = { id: string; email: string; invited_at: string; resent_at: string | null }

/** Accepted into the program but haven't made their account yet. */
export async function loadPendingInvites(admin: Admin, courseId: string): Promise<PendingInvite[]> {
  const { data } = await admin.from('invitations')
    .select('id, email, invited_at, resent_at, role, status').eq('course_id', courseId).eq('status', 'pending')
  return ((data ?? []) as (PendingInvite & { role: string })[])
    .filter(i => i.role === 'student')
    .map(({ id, email, invited_at, resent_at }) => ({ id, email, invited_at, resent_at }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

/** When each student finished (their course_completions row for this course). */
export async function loadFinishedAt(admin: Admin, courseId: string): Promise<Map<string, string>> {
  const { data } = await admin.from('course_completions').select('user_id, completed_at').eq('course_id', courseId)
  return new Map(((data ?? []) as { user_id: string; completed_at: string }[]).map(r => [r.user_id, r.completed_at]))
}

// ── Hardware needs and equipment ─────────────────────────────────────────────

export async function loadNeeds(admin: Admin, studentIds: string[]): Promise<Map<string, StudentNeeds>> {
  const map = new Map<string, StudentNeeds>()
  for (const part of chunks(studentIds)) {
    const { data } = await admin.from('hardware_student_needs').select('student_id, laptop, wifi').in('student_id', part)
    for (const r of (data ?? []) as { student_id: string; laptop: string; wifi: string }[]) {
      map.set(r.student_id, {
        laptop: isLaptopNeed(r.laptop) ? r.laptop : DEFAULT_NEEDS.laptop,
        wifi: isWifiChoice(r.wifi) ? r.wifi : DEFAULT_NEEDS.wifi,
      })
    }
  }
  return map
}

export const needsFor = (map: Map<string, StudentNeeds>, studentId: string): StudentNeeds => map.get(studentId) ?? DEFAULT_NEEDS

export type CohortEquipment = {
  needs: Map<string, StudentNeeds>
  /** Devices each student has right now */
  held: Map<string, HardwareDevice[]>
  /** Open waitlist entries: kind → added_at */
  waiting: Map<string, Map<DeviceKind, string>>
  shipments: Map<string, Shipment[]>
  plans: Map<string, InternetPlan[]>
}




export async function loadCohortEquipment(admin: Admin, studentIds: string[]): Promise<CohortEquipment> {
  const result: CohortEquipment = { needs: await loadNeeds(admin, studentIds), held: new Map(), waiting: new Map(), shipments: new Map(), plans: new Map() }
  const push = <T>(map: Map<string, T[]>, key: string, value: T) => map.set(key, [...(map.get(key) ?? []), value])
  for (const part of chunks(studentIds)) {
    const [{ data: devices }, { data: waitlist }, { data: shipments }, { data: plans }] = await Promise.all([
      admin.from('hardware_devices').select(DEVICE_COLUMNS).in('current_holder_id', part).order('asset_tag'),
      admin.from('hardware_waitlist').select('student_id, kind, added_at').in('student_id', part).is('fulfilled_at', null).is('removed_at', null),
      admin.from('hardware_shipments').select(SHIPMENT_COLUMNS).in('student_id', part).order('shipped_on', { ascending: false }),
      admin.from('hardware_internet_plans').select(PLAN_COLUMNS).in('student_id', part).order('starts_on', { ascending: false }),
    ])
    for (const d of (devices ?? []) as HardwareDevice[]) if (d.current_holder_id) push(result.held, d.current_holder_id, d)
    for (const w of (waitlist ?? []) as { student_id: string; kind: DeviceKind; added_at: string }[]) {
      const m = result.waiting.get(w.student_id) ?? new Map<DeviceKind, string>()
      m.set(w.kind, w.added_at)
      result.waiting.set(w.student_id, m)
    }
    for (const s of (shipments ?? []) as Shipment[]) push(result.shipments, s.student_id, s)
    for (const p of (plans ?? []) as InternetPlan[]) push(result.plans, p.student_id, p)
  }
  return result
}

// ── Finishing ────────────────────────────────────────────────────────────────

/** Records `key` in hardware_alerts_sent; false if it was already there. */
async function claimOnce(admin: Admin, key: string): Promise<boolean> {
  const { error } = await admin.from('hardware_alerts_sent').insert({ key })
  return !error
}

/**
 * Puts the student on the waitlist for each device their needs call for and they don't
 * already have. Duplicate entries are refused by the table's unique index and ignored.
 */
export async function addNeededToWaitlist(admin: Admin, studentId: string, needs: StudentNeeds, note: string, actorId: string | null): Promise<DeviceKind[]> {
  const { data: devices } = await admin.from('hardware_devices').select('kind').eq('current_holder_id', studentId)
  const held = new Set(((devices ?? []) as { kind: DeviceKind }[]).map(d => d.kind))
  const added: DeviceKind[] = []
  for (const kind of deviceKindsNeeded(needs)) {
    if (held.has(kind)) continue
    const { error } = await admin.from('hardware_waitlist').insert({ student_id: studentId, kind, note, added_by: actorId })
    if (!error) added.push(kind)
  }
  return added
}

/**
 * Called whenever a student might just have finished an Enrollment Readiness course (an
 * assignment marked Complete, or the onboarding page loading). If every counted assignment
 * is Complete, the first call: ticks Completed for the course, adds them to the hardware
 * waitlist for what they need, and posts in #student-hardware. Returns whether they're finished.
 *
 * `force` skips the assignment check: staff ticked Completed by hand on the Users page.
 */
export async function finishOnboardingIfDone(
  admin: Admin,
  courseId: string,
  studentId: string,
  actorId: string | null,
  progress?: OnboardingProgress,
  { force = false }: { force?: boolean } = {},
): Promise<boolean> {
  const { data: course } = await admin.from('courses').select('id, name, is_enrollment_readiness').eq('id', courseId).maybeSingle()
  if (!(course as { is_enrollment_readiness?: boolean } | null)?.is_enrollment_readiness) return false
  const { data: enrollment } = await admin.from('course_enrollments').select('role').eq('course_id', courseId).eq('user_id', studentId).maybeSingle()
  if ((enrollment as { role?: string } | null)?.role !== 'student') return false

  if (!force) {
    const current = progress ?? await loadStudentProgress(admin, courseId, studentId)
    if (!current.finished) return false
  }
  if (!(await claimOnce(admin, onboardingFinishedKey(courseId, studentId)))) return true

  await admin.from('course_completions').upsert(
    { course_id: courseId, user_id: studentId, marked_by: actorId },
    { onConflict: 'course_id,user_id', ignoreDuplicates: true },
  )
  const courseName = (course as { name: string }).name
  const needs = needsFor(await loadNeeds(admin, [studentId]), studentId)
  await addNeededToWaitlist(admin, studentId, needs, `Finished ${courseName}`, actorId)

  const { data: student } = await admin.from('users').select('name, email').eq('id', studentId).maybeSingle()
  const person = student as { name: string | null; email: string } | null
  const name = slackEscape(person?.name ?? person?.email ?? 'A student')
  const wanted = [...deviceKindsNeeded(needs), ...(needs.wifi === 'comcast_now' ? ['comcast_now'] : [])]
  const text = `🎓 <${appUrl()}/instructor/onboarding/${courseId}/students/${studentId}|${name}> finished *${slackEscape(courseName)}*` +
    (wanted.length ? ` and needs ${describeNeeds(wanted)}.` : '. They have their own laptop and no wifi needs, so there’s nothing to ship.')
  after(async () => {
    await slackPostMessage(hardwareChannel(), text).catch(() => false)
  })
  return true
}

/**
 * For the grading actions: after an assignment is marked Complete, check whether that
 * finished the student's Enrollment Readiness course. Never throws, so grading can't fail
 * because of it.
 */
export async function checkOnboardingAfterGrade(admin: Admin, courseId: string | null | undefined, studentId: string, actorId: string): Promise<void> {
  if (!courseId) return
  try {
    if (!(await isEnrollmentReadinessCourse(admin, courseId))) return
    await finishOnboardingIfDone(admin, courseId, studentId, actorId)
  } catch (e) {
    console.error('onboarding: finish check failed', e)
  }
}

/** The student's most recent Enrollment Readiness course and whether they've finished it, for My Equipment. */
export async function loadMyOnboarding(admin: Admin, studentId: string, today: string = pacificToday()): Promise<{ courseId: string; finished: boolean } | null> {
  const { data: enrollments } = await admin.from('course_enrollments').select('course_id').eq('user_id', studentId).eq('role', 'student')
  const courseIds = ((enrollments ?? []) as { course_id: string }[]).map(e => e.course_id)
  if (courseIds.length === 0) return null
  const { data: courses } = await admin.from('courses').select('id, start_date, end_date')
    .in('id', courseIds).eq('is_enrollment_readiness', true).order('start_date', { ascending: false })
  // Once a cohort ended a while ago, its students are in class; nothing to say any more.
  const course = ((courses ?? []) as { id: string; start_date: string | null; end_date: string | null }[])
    .find(c => !c.end_date || c.end_date.slice(0, 10) >= addDaysIso(today, -60))
  if (!course) return null
  const { finished } = await loadStudentOnboarding(admin, course.id, studentId, today)
  return { courseId: course.id, finished }
}

/**
 * One student's progress plus whether they count as finished: every counted assignment is
 * Complete, or they already finished once (their Completed tick for the course). Finishing
 * sticks, so work added or unmarked later doesn't take back equipment that's on its way;
 * unticking Completed on the Users page is how staff undo it.
 */
export async function loadStudentOnboarding(admin: Admin, courseId: string, studentId: string, today: string = pacificToday()): Promise<{ progress: OnboardingProgress; finished: boolean; finishedAt: string | null }> {
  const [progress, { data: completion }] = await Promise.all([
    loadStudentProgress(admin, courseId, studentId, today),
    admin.from('course_completions').select('completed_at').eq('course_id', courseId).eq('user_id', studentId).maybeSingle(),
  ])
  const finishedAt = (completion as { completed_at: string } | null)?.completed_at ?? null
  return { progress, finished: progress.finished || !!finishedAt, finishedAt }
}

function addDaysIso(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

// ── The New Student Onboarding page ──────────────────────────────────────────

export type OnboardingRow = {
  student: Person
  progress: OnboardingProgress
  /** Every counted assignment Complete, or finished once already (see loadStudentOnboarding) */
  finished: boolean
  /** When they finished (their Completed tick for this course), if they have */
  finishedAt: string | null
  /** Has signed in at least once (invited students are enrolled straight away, before they sign up) */
  signedIn: boolean
  /** Already enrolled in the cohort's next course */
  inNextCourse: boolean
}

/** Whether each user has ever signed in, from Supabase auth (a few at a time). */
async function loadSignedIn(admin: Admin, ids: string[]): Promise<Set<string>> {
  const signedIn = new Set<string>()
  for (let i = 0; i < ids.length; i += 10) {
    const results = await Promise.all(ids.slice(i, i + 10).map(id =>
      admin.auth.admin.getUserById(id).catch(() => ({ data: { user: null } })),
    ))
    results.forEach((r, j) => {
      if ((r as { data: { user: { last_sign_in_at?: string | null } | null } }).data?.user?.last_sign_in_at) signedIn.add(ids[i + j])
    })
  }
  return signedIn
}

export type OnboardingCohort = {
  assignments: OnboardingAssignment[]
  rows: OnboardingRow[]
  invites: PendingInvite[]
}

/** Student ids already handled by finishOnboardingIfDone for this course. */
async function loadFinishedClaims(admin: Admin, courseId: string): Promise<Set<string>> {
  const prefix = `onboarding-finished:${courseId}:`
  const { data } = await admin.from('hardware_alerts_sent').select('key').like('key', `${prefix}%`)
  return new Set(((data ?? []) as { key: string }[]).map(r => r.key.slice(prefix.length)))
}

/**
 * Everything the onboarding page shows for one cohort. Anyone who has finished without the
 * finish steps having run (e.g. their last assignment was excused rather than marked
 * Complete) gets them now.
 */
export async function loadOnboardingCohort(admin: Admin, course: CohortCourse, today: string = pacificToday()): Promise<OnboardingCohort> {
  const [students, invites] = await Promise.all([loadCohortStudents(admin, course.id), loadPendingInvites(admin, course.id)])
  const ids = students.map(s => s.id)
  const [{ assignments, progress }, claims] = await Promise.all([
    loadCohortProgress(admin, course.id, ids, today),
    loadFinishedClaims(admin, course.id),
  ])

  const unclaimed = students.filter(s => progress.get(s.id)?.finished && !claims.has(s.id))
  for (const s of unclaimed) {
    try {
      await finishOnboardingIfDone(admin, course.id, s.id, null, progress.get(s.id))
    } catch (e) {
      console.error('onboarding: finish on page load failed', e)
    }
  }

  const [finishedAt, signedIn] = await Promise.all([loadFinishedAt(admin, course.id), loadSignedIn(admin, ids)])
  const nextIds = new Set<string>()
  if (course.onboarding_next_course_id && ids.length) {
    for (const part of chunks(ids)) {
      const { data } = await admin.from('course_enrollments').select('user_id')
        .eq('course_id', course.onboarding_next_course_id).in('user_id', part)
      for (const r of (data ?? []) as { user_id: string }[]) nextIds.add(r.user_id)
    }
  }

  // Inviting someone enrolls them straight away, so only list invitations nobody enrolled matches.
  const enrolledEmails = new Set(students.map(s => s.email.toLowerCase()))
  return {
    assignments,
    invites: invites.filter(i => !enrolledEmails.has(i.email.toLowerCase())),
    rows: students.map(student => ({
      student,
      progress: progress.get(student.id)!,
      finished: progress.get(student.id)!.finished || finishedAt.has(student.id),
      finishedAt: finishedAt.get(student.id) ?? null,
      signedIn: signedIn.has(student.id),
      inNextCourse: nextIds.has(student.id),
    })),
  }
}

// ── A student's own My Equipment ─────────────────────────────────────────────

export type MyEquipmentExtras = {
  /** Equipment they're still waiting for (not shipped yet) */
  pending: PendingItem[]
  /** Boxes on their way (not confirmed arrived), newest first */
  inTransit: Shipment[]
  wifi: StudentNeeds['wifi']
  /** A current Comcast NOW plan */
  hasInternetPlan: boolean
}

/**
 * The onboarding side of My Equipment for the signed-in student: what's coming, what's on
 * its way and their wifi. Callers pass the student's own id (from auth), never one from the request.
 */
export async function loadMyEquipmentExtras(admin: Admin, userId: string, devices: HardwareDevice[], today: string = pacificToday()): Promise<MyEquipmentExtras> {
  const [equipment, onboarding] = await Promise.all([loadCohortEquipment(admin, [userId]), loadMyOnboarding(admin, userId, today)])
  const needs = needsFor(equipment.needs, userId)
  const shipments = equipment.shipments.get(userId) ?? []
  return {
    pending: pendingEquipment({
      needs,
      heldKinds: devices.filter(d => d.status !== 'awaiting_return').map(d => d.kind),
      waitingKinds: [...(equipment.waiting.get(userId)?.keys() ?? [])],
      onboarding: onboarding ? (onboarding.finished ? 'finished' : 'in_progress') : null,
    }),
    inTransit: inTransit(shipments).filter(s => s.device_ids.some(id => devices.some(d => d.id === id))),
    wifi: needs.wifi,
    hasInternetPlan: (equipment.plans.get(userId) ?? []).some(p => isPlanCurrent(p, today)),
  }
}

/**
 * Courses a cohort can move on to: not templates, archived or Enrollment Readiness, and not
 * long over. Tech Career Foundations courses first, newest first; the current choice always shows.
 */
export async function loadNextCourseOptions(admin: Admin, today: string, keepId: string | null): Promise<{ id: string; name: string }[]> {
  const { data } = await admin.from('courses').select('id, name, start_date, end_date, is_template, archived, is_enrollment_readiness')
  const cutoff = addDaysIso(today, -30)
  type Row = { id: string; name: string; start_date: string | null; end_date: string | null; is_template: boolean | null; archived: boolean | null; is_enrollment_readiness: boolean | null }
  const tcf = (r: Row) => /^tech career foundations/i.test(r.name.trim())
  return ((data ?? []) as Row[])
    .filter(r => r.id === keepId || (!r.is_template && !r.archived && !r.is_enrollment_readiness && (!r.end_date || r.end_date.slice(0, 10) >= cutoff)))
    .sort((a, b) => Number(tcf(b)) - Number(tcf(a)) || (b.start_date ?? '').localeCompare(a.start_date ?? '') || a.name.localeCompare(b.name))
    .map(r => ({ id: r.id, name: r.name }))
}

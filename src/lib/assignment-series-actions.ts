'use server'

// Repeating assignments ("series") and the "I met my goal" check-off.
// Pure rules live in assignment-series.ts; this file does the database work.

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAssignmentCourseId } from '@/lib/course-scope'
import { requireCourseInstructorAccess, isCourseAccessError } from '@/lib/course-access'
import { compareOutlinePosition, copyDueDate, courseWeeks, dayOffset, membersAfter, normalizeGoalLabel, placeInWeek, usualDayName, type Closure, type OutlinePosition } from '@/lib/assignment-series'

type Admin = ReturnType<typeof createServiceSupabaseClient>

// Day panels that are not real days, never offered as a target for a weekly copy.
const SKIP_DAYS = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])

export type SeriesWeek = {
  moduleId: string
  title: string
  weekNumber: number | null
  // The series copy in this week, if there is one.
  assignmentId: string | null
  dueDate: string | null
  published: boolean
  hasWork: boolean
  isCurrent: boolean
}

export type SeriesInfo = {
  seriesId: string | null
  dayName: string
  goalLabel: string | null
  weeks: SeriesWeek[]
}

type ModuleRow = { id: string; title: string | null; week_number: number | null; order: number; category: string | null; published: boolean | null }
type DayRow = { id: string; module_id: string; day_name: string; order: number }
type AssignmentRow = {
  id: string; module_day_id: string; order: number; series_id: string | null; due_date: string | null; published: boolean
}

/** Every coding module and day in a course, plus the assignments of one series. */
async function loadCourseOutline(admin: Admin, courseId: string, seriesId: string | null) {
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, week_number, order, category, published')
    .eq('course_id', courseId)
    .is('deleted_at', null)
  const mods = ((modules ?? []) as ModuleRow[]).filter(m => m.category !== 'career' && m.category !== 'level_up' && m.title)
  const moduleIds = mods.map(m => m.id)
  const { data: days } = moduleIds.length
    ? await admin.from('module_days').select('id, module_id, day_name, order').in('module_id', moduleIds).is('deleted_at', null)
    : { data: [] }
  const dayRows = (days ?? []) as DayRow[]
  const { data: members } = seriesId
    ? await admin
        .from('assignments')
        .select('id, module_day_id, order, series_id, due_date, published')
        .eq('series_id', seriesId)
        .is('deleted_at', null)
    : { data: [] }
  return { modules: mods, days: dayRows, members: (members ?? []) as AssignmentRow[] }
}

function positionOf(
  a: Pick<AssignmentRow, 'id' | 'module_day_id' | 'order'>,
  dayById: Map<string, DayRow>,
  moduleById: Map<string, ModuleRow>,
): OutlinePosition | null {
  const day = dayById.get(a.module_day_id)
  const mod = day ? moduleById.get(day.module_id) : undefined
  if (!day || !mod) return null
  return { id: a.id, weekNumber: mod.week_number, moduleOrder: mod.order, dayOrder: day.order, order: a.order }
}

/** Series members in course outline order, each with its position. */
async function seriesPositions(admin: Admin, courseId: string, seriesId: string) {
  const { modules, days, members } = await loadCourseOutline(admin, courseId, seriesId)
  const dayById = new Map(days.map(d => [d.id, d]))
  const moduleById = new Map(modules.map(m => [m.id, m]))
  return members
    .map(m => positionOf(m, dayById, moduleById))
    .filter((p): p is OutlinePosition => p !== null)
    .sort(compareOutlinePosition)
}

/** Ids of assignments that already have turned-in or graded work from anyone. */
async function assignmentsWithWork(admin: Admin, assignmentIds: string[]): Promise<Set<string>> {
  if (assignmentIds.length === 0) return new Set()
  const { data } = await admin
    .from('submissions')
    .select('assignment_id')
    .in('assignment_id', assignmentIds)
    .neq('status', 'draft')
  return new Set((data ?? []).map((r: { assignment_id: string }) => r.assignment_id))
}

async function requireStaffForAssignment(assignmentId: string, courseId: string) {
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code as string | undefined }
  const admin = createServiceSupabaseClient()
  if ((await getAssignmentCourseId(admin, assignmentId)) !== courseId) return { error: 'Assignment not found in this course', code: undefined }
  return { admin, userId: access.user.id } as const
}

// ── Reading ──────────────────────────────────────────────────────────────────────────────

export type DueDateCalendar = { courseStart: string | null; closures: Closure[] }

/** The course start date plus every holiday and break, for working out default due dates. */
async function loadDueDateCalendar(admin: Admin, courseId: string): Promise<DueDateCalendar> {
  const [{ data: course }, { data: holidays }, { data: breaks }] = await Promise.all([
    admin.from('courses').select('start_date').eq('id', courseId).single(),
    admin.from('calendar_holidays').select('label, date, end_date'),
    admin.from('calendar_breaks').select('label, start_date, end_date'),
  ])
  const closures: Closure[] = [
    ...((holidays ?? []) as { label: string; date: string; end_date: string | null }[])
      .filter(h => h.date).map(h => ({ label: h.label, start: h.date, end: h.end_date })),
    ...((breaks ?? []) as { label: string; start_date: string; end_date: string | null }[])
      .filter(b => b.start_date).map(b => ({ label: b.label, start: b.start_date, end: b.end_date })),
  ]
  return { courseStart: course?.start_date ?? null, closures }
}

/** For the Create dialog: lets it show each week's default due date before anything is made. */
export async function getDueDateCalendar(courseId: string): Promise<DueDateCalendar | { error: string }> {
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error }
  return loadDueDateCalendar(createServiceSupabaseClient(), courseId)
}

/** The weeks of a course, marking which ones already hold a copy of this assignment. */
export async function getSeriesInfo(assignmentId: string, courseId: string): Promise<SeriesInfo | { error: string }> {
  const auth = await requireStaffForAssignment(assignmentId, courseId)
  if ('error' in auth) return { error: auth.error ?? 'Not authorized' }
  const { admin } = auth

  const { data: source } = await admin
    .from('assignments')
    .select('id, module_day_id, series_id, goal_checkoff_label, module_days!module_day_id(day_name, module_id)')
    .eq('id', assignmentId)
    .single()
  if (!source) return { error: 'Assignment not found' }
  const sourceDay = (Array.isArray(source.module_days) ? source.module_days[0] : source.module_days) as { day_name: string; module_id: string } | null

  const { modules, days, members } = await loadCourseOutline(admin, courseId, source.series_id)
  const dayById = new Map(days.map(d => [d.id, d]))
  const copies = members.length > 0 ? members : [{ id: source.id, module_day_id: source.module_day_id, order: 0, series_id: null, due_date: null, published: false }]
  const withWork = await assignmentsWithWork(admin, copies.map(c => c.id))
  const copyByModule = new Map<string, AssignmentRow>()
  for (const c of copies) {
    const day = dayById.get(c.module_day_id)
    if (day && !copyByModule.has(day.module_id)) copyByModule.set(day.module_id, c as AssignmentRow)
  }

  // Real course weeks, plus any other module that already holds a copy.
  const realWeeks = new Set(courseWeeks(modules).map(m => m.id))
  const weeks: SeriesWeek[] = [...modules]
    .filter(m => realWeeks.has(m.id) || copyByModule.has(m.id))
    .sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0) || a.order - b.order)
    .map(m => {
      const copy = copyByModule.get(m.id) ?? null
      return {
        moduleId: m.id,
        title: m.title ?? '',
        weekNumber: m.week_number,
        assignmentId: copy?.id ?? null,
        dueDate: copy?.due_date ?? null,
        published: copy?.published ?? false,
        hasWork: copy ? withWork.has(copy.id) : false,
        isCurrent: copy?.id === assignmentId,
      }
    })

  return {
    seriesId: source.series_id,
    // The series' usual day: what most copies sit on, so one week moved off a holiday
    // doesn't change where new copies go.
    dayName: usualDayName(copies.map(c => dayById.get(c.module_day_id)?.day_name ?? '').filter(Boolean)) || (sourceDay?.day_name ?? ''),
    goalLabel: source.goal_checkoff_label,
    weeks,
  }
}

// ── Pushing to weeks ─────────────────────────────────────────────────────────────────────

export type PushResult = {
  created?: number
  /** Weeks where the usual day is a holiday, so the copy went on another day. */
  moved?: { week: string; from: string; to: string; holiday: string }[]
  /** Weeks with no open day at all (a break), so no copy was made. */
  skipped?: { week: string; holiday: string }[]
  error?: string
  code?: string
}

/**
 * Copies an assignment into other weeks of the same course, on the same day name
 * (the day is created if that week doesn't have it). Each copy gets the due date moved by
 * the number of weeks between the modules, the same checklist, skills and goal check-off,
 * and joins the source's series. Students who already had a goal confirmed earlier in the
 * series start out excused from the new copies.
 */
export async function pushAssignmentToWeeks(params: {
  assignmentId: string
  courseId: string
  moduleIds: string[]
  /** The usual weekday for the copies (defaults to this assignment's own day). */
  dayName?: string
}): Promise<PushResult> {
  const auth = await requireStaffForAssignment(params.assignmentId, params.courseId)
  if ('error' in auth) return { error: auth.error, code: auth.code }
  const { admin } = auth

  const { data: source } = await admin
    .from('assignments')
    .select('*')
    .eq('id', params.assignmentId)
    .single()
  if (!source) return { error: 'Assignment not found' }

  const seriesId: string = source.series_id ?? crypto.randomUUID()
  if (!source.series_id) {
    const { error } = await admin.from('assignments').update({ series_id: seriesId }).eq('id', source.id)
    if (error) return { error: error.message }
  }

  const { modules, days, members } = await loadCourseOutline(admin, params.courseId, seriesId)
  const moduleById = new Map(modules.map(m => [m.id, m]))
  const dayById = new Map(days.map(d => [d.id, d]))
  const sourceDay = dayById.get(source.module_day_id)
  const sourceModule = sourceDay ? moduleById.get(sourceDay.module_id) : undefined
  if (!sourceDay || !sourceModule) return { error: 'This assignment is not in a course outline week' }
  if (SKIP_DAYS.has(sourceDay.day_name)) return { error: 'Move this assignment onto a day first' }
  if (params.dayName && dayOffset(params.dayName) == null) return { error: 'Pick a weekday' }
  const usualDay = params.dayName ?? sourceDay.day_name

  // Weeks that already hold a copy are skipped, so pushing twice never duplicates.
  const weeksWithCopy = new Set(members.map(m => dayById.get(m.module_day_id)?.module_id).filter(Boolean))
  const targets = [...new Set(params.moduleIds)].filter(id => moduleById.has(id) && !weeksWithCopy.has(id))
  if (targets.length === 0) return { created: 0 }

  const calendar = await loadDueDateCalendar(admin, params.courseId)
  const [{ data: checklist }, { data: skills }] = await Promise.all([
    admin.from('checklist_items').select('text, description, order, required').eq('assignment_id', source.id),
    admin.from('confidence_tracker_assignment_skills').select('skill_id').eq('assignment_id', source.id),
  ])

  // Fields that belong to this one assignment, not to the content being copied.
  const {
    id: _id, module_day_id: _day, linked_day_id: _linked, due_date: _due, created_at: _created,
    updated_at: _updated, canvas_assignment_id: _canvas, deleted_at: _deleted, order: _order,
    ...content
  } = source
  void _id; void _day; void _linked; void _due; void _created; void _updated; void _canvas; void _deleted; void _order

  const createdIds: string[] = []
  const moved: NonNullable<PushResult['moved']> = []
  const skipped: NonNullable<PushResult['skipped']> = []
  for (const moduleId of targets) {
    const mod = moduleById.get(moduleId)!
    // Usually the same day; a holiday moves it to the day before (or skips a break week).
    const placement = placeInWeek(calendar.courseStart, mod.week_number, usualDay, calendar.closures)
    if (placement?.kind === 'skipped') {
      skipped.push({ week: mod.title ?? '', holiday: placement.closure.label })
      continue
    }
    const dayName = placement?.dayName ?? usualDay
    if (placement?.movedFrom) {
      moved.push({ week: mod.title ?? '', from: placement.movedFrom.dayName, to: dayName, holiday: placement.movedFrom.closure.label })
    }
    let day = days.find(d => d.module_id === moduleId && d.day_name === dayName)
    if (!day) {
      const order = days.filter(d => d.module_id === moduleId).length
      const { data: newDay, error: dayErr } = await admin
        .from('module_days')
        .insert({ module_id: moduleId, day_name: dayName, order })
        .select('id, module_id, day_name, order')
        .single()
      if (dayErr || !newDay) return { error: dayErr?.message ?? 'Could not create a day', created: createdIds.length }
      day = newDay as DayRow
      days.push(day)
    }
    const { count } = await admin
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('module_day_id', day.id)
      .is('deleted_at', null)

    const { data: copy, error: copyErr } = await admin
      .from('assignments')
      .insert({
        ...content,
        module_day_id: day.id,
        linked_day_id: null,
        series_id: seriesId,
        order: count ?? 0,
        due_date: placement ? placement.due.dueDate : copyDueDate({
          ...calendar,
          dayName: usualDay,
          sourceDueDate: source.due_date,
          fromWeek: sourceModule.week_number,
          toWeek: mod.week_number,
        }),
      })
      .select('id')
      .single()
    if (copyErr || !copy) return { error: copyErr?.message ?? 'Could not copy the assignment', created: createdIds.length }
    createdIds.push(copy.id)

    if (checklist && checklist.length > 0) {
      await admin.from('checklist_items').insert(checklist.map(ci => ({ ...ci, assignment_id: copy.id })))
    }
    if (skills && skills.length > 0) {
      await admin.from('confidence_tracker_assignment_skills').insert(skills.map(s => ({ skill_id: s.skill_id, assignment_id: copy.id })))
    }
  }

  await excuseNewCopiesForConfirmedGoals(admin, params.courseId, seriesId, createdIds)

  revalidatePath(`/instructor/courses/${params.courseId}`, 'layout')
  return { created: createdIds.length, moved, skipped }
}

/** New copies placed after a student's confirmed goal are excused for that student too. */
async function excuseNewCopiesForConfirmedGoals(admin: Admin, courseId: string, seriesId: string, newIds: string[]) {
  if (newIds.length === 0) return
  const positions = await seriesPositions(admin, courseId, seriesId)
  const memberIds = positions.map(p => p.id)
  const { data: claims } = await admin
    .from('assignment_goal_claims')
    .select('id, assignment_id, student_id, excused_assignment_ids')
    .in('assignment_id', memberIds)
    .not('confirmed_at', 'is', null)
  for (const claim of claims ?? []) {
    const later = new Set(membersAfter(claim.assignment_id, positions).map(p => p.id))
    const toExcuse = newIds.filter(id => later.has(id))
    if (toExcuse.length === 0) continue
    await admin.from('assignment_overrides').upsert(
      toExcuse.map(assignment_id => ({ assignment_id, student_id: claim.student_id, excused: true })),
      { onConflict: 'assignment_id,student_id' },
    )
    await admin
      .from('assignment_goal_claims')
      .update({ excused_assignment_ids: [...new Set([...(claim.excused_assignment_ids ?? []), ...toExcuse])] })
      .eq('id', claim.id)
  }
}

/**
 * Copies this assignment's content (title, instructions, how to turn in, settings,
 * checklist, goal check-off) onto the following weeks of its series (later in the course
 * outline) that nobody has turned anything in for yet. Earlier weeks are never touched.
 * Due dates and published state are left alone.
 */
export async function updateUpcomingWeeks(params: {
  assignmentId: string
  courseId: string
}): Promise<{ updated?: number; skipped?: number; error?: string }> {
  const auth = await requireStaffForAssignment(params.assignmentId, params.courseId)
  if ('error' in auth) return { error: auth.error ?? 'Not authorized' }
  const { admin } = auth

  const { data: source } = await admin
    .from('assignments')
    .select('id, series_id, title, description, how_to_turn_in, submission_required, answer_key_url, skill_tags, is_bonus, is_optional, goal_checkoff_label')
    .eq('id', params.assignmentId)
    .single()
  if (!source?.series_id) return { error: 'This assignment does not repeat' }

  const positions = await seriesPositions(admin, params.courseId, source.series_id)
  const others = membersAfter(source.id, positions).map(p => p.id)
  const withWork = await assignmentsWithWork(admin, others)
  const targets = others.filter(id => !withWork.has(id))

  const { id: _id, series_id: _series, ...content } = source
  void _id; void _series
  const { data: sourceChecklist } = await admin
    .from('checklist_items')
    .select('text, description, order, required')
    .eq('assignment_id', source.id)
    .order('order')
  const wanted = sourceChecklist ?? []

  for (const targetId of targets) {
    const { error } = await admin.from('assignments').update(content).eq('id', targetId)
    if (error) return { error: error.message }

    // Match checklist items by position so a student's own checks on unchanged items stay.
    const { data: existing } = await admin
      .from('checklist_items')
      .select('id')
      .eq('assignment_id', targetId)
      .order('order')
    const current = existing ?? []
    for (let i = 0; i < wanted.length; i++) {
      if (current[i]) await admin.from('checklist_items').update(wanted[i]).eq('id', current[i].id)
      else await admin.from('checklist_items').insert({ ...wanted[i], assignment_id: targetId })
    }
    const extra = current.slice(wanted.length).map(c => c.id)
    if (extra.length > 0) {
      await admin.from('student_checklist_progress').delete().in('checklist_item_id', extra)
      await admin.from('checklist_items').delete().in('id', extra)
    }
  }

  revalidatePath(`/instructor/courses/${params.courseId}`, 'layout')
  return { updated: targets.length, skipped: withWork.size }
}

/** Takes one assignment out of its series (it stays as a regular assignment). */
export async function leaveSeries(params: { assignmentId: string; courseId: string }): Promise<{ error?: string }> {
  const auth = await requireStaffForAssignment(params.assignmentId, params.courseId)
  if ('error' in auth) return { error: auth.error ?? 'Not authorized' }
  const { error } = await auth.admin.from('assignments').update({ series_id: null }).eq('id', params.assignmentId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${params.courseId}`, 'layout')
  return {}
}

// ── Goal check-off ───────────────────────────────────────────────────────────────────────

/** Turns the "I met my goal" checkbox on (with a label) or off, for this week or every week. */
export async function setGoalCheckoff(params: {
  assignmentId: string
  courseId: string
  label: string | null
  wholeSeries: boolean
}): Promise<{ error?: string }> {
  const auth = await requireStaffForAssignment(params.assignmentId, params.courseId)
  if ('error' in auth) return { error: auth.error ?? 'Not authorized' }
  const { admin } = auth
  const label = normalizeGoalLabel(params.label)

  const { data: source } = await admin.from('assignments').select('series_id').eq('id', params.assignmentId).single()
  let ids = [params.assignmentId]
  if (params.wholeSeries && source?.series_id) {
    ids = (await seriesPositions(admin, params.courseId, source.series_id)).map(p => p.id)
  }
  const { error } = await admin.from('assignments').update({ goal_checkoff_label: label }).in('id', ids)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${params.courseId}`, 'layout')
  return {}
}

/**
 * A student checks or unchecks "I met my goal". Only the student themself, enrolled as a
 * student in the assignment's course, on a published assignment with the check-off on.
 * A goal the grader already confirmed can't be unchecked by the student.
 */
export async function setGoalClaim(params: {
  assignmentId: string
  courseId: string
  claimed: boolean
}): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  if ((await getAssignmentCourseId(admin, params.assignmentId)) !== params.courseId) return { error: 'Assignment not found' }

  const [{ data: enrollment }, { data: assignment }] = await Promise.all([
    admin.from('course_enrollments').select('role').eq('course_id', params.courseId).eq('user_id', user.id).maybeSingle(),
    admin.from('assignments').select('published, goal_checkoff_label, deleted_at').eq('id', params.assignmentId).single(),
  ])
  if (enrollment?.role !== 'student') return { error: 'Only students can check this' }
  if (!assignment?.published || assignment.deleted_at || !assignment.goal_checkoff_label) return { error: 'This assignment has no goal check-off' }

  const { data: existing } = await admin
    .from('assignment_goal_claims')
    .select('id, confirmed_at')
    .eq('assignment_id', params.assignmentId)
    .eq('student_id', user.id)
    .maybeSingle()

  if (params.claimed) {
    if (existing) return {}
    const { error } = await admin.from('assignment_goal_claims').insert({ assignment_id: params.assignmentId, student_id: user.id })
    if (error) return { error: error.message }
    await queueForGrading(admin, params.assignmentId, user.id)
  } else {
    if (!existing) return {}
    if (existing.confirmed_at) return { error: 'Your instructor already confirmed this goal' }
    const { error } = await admin.from('assignment_goal_claims').delete().eq('id', existing.id)
    if (error) return { error: error.message }
    await unqueueForGrading(admin, params.assignmentId, user.id)
  }
  return {}
}

// The to-grade queue is submissions with status 'submitted'. A student resubmitting clears
// the grade, so 'submitted' with a grade still on it only ever comes from a goal check:
// that is what lets un-checking or confirming put it back to 'graded' safely.

/** Puts the student's work for this assignment back in the grader's to-grade queue. */
async function queueForGrading(admin: Admin, assignmentId: string, studentId: string) {
  const { data: sub } = await admin
    .from('submissions')
    .select('id, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (sub?.status === 'graded') {
    await admin.from('submissions').update({ status: 'submitted' }).eq('id', sub.id)
  }
  // Not turned in yet (no submission, or a draft): nothing is created, so it stays missing
  // once it's past due, and it joins the queue when they turn it in.
}

/** Takes a goal check back out of the queue: graded work goes back to graded. */
async function unqueueForGrading(admin: Admin, assignmentId: string, studentId: string) {
  const { data: sub } = await admin
    .from('submissions')
    .select('id, status, grade')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (sub?.status !== 'submitted') return
  if (sub.grade) await admin.from('submissions').update({ status: 'graded' }).eq('id', sub.id)
}

/**
 * The grader confirms (or un-confirms) a student's "I met my goal". Confirming excuses
 * the student from every later week of the series; un-confirming puts back only the
 * excusals this confirmation made (an extension the student already had is kept).
 */
export async function confirmGoalClaim(params: {
  assignmentId: string
  courseId: string
  studentId: string
  confirmed: boolean
}): Promise<{ excused?: number; error?: string }> {
  const auth = await requireStaffForAssignment(params.assignmentId, params.courseId)
  if ('error' in auth) return { error: auth.error ?? 'Not authorized' }
  const { admin, userId } = auth

  const { data: claim } = await admin
    .from('assignment_goal_claims')
    .select('id, confirmed_at, excused_assignment_ids')
    .eq('assignment_id', params.assignmentId)
    .eq('student_id', params.studentId)
    .maybeSingle()
  if (!claim) return { error: 'This student has not checked that they met their goal' }

  if (params.confirmed) {
    if (claim.confirmed_at) return { excused: claim.excused_assignment_ids?.length ?? 0 }
    const { data: assignment } = await admin.from('assignments').select('series_id').eq('id', params.assignmentId).single()
    const later = assignment?.series_id
      ? membersAfter(params.assignmentId, await seriesPositions(admin, params.courseId, assignment.series_id)).map(p => p.id)
      : []
    // Leave alone weeks the student was already excused from, so un-confirming never
    // removes an excusal someone made by hand.
    const { data: already } = later.length
      ? await admin.from('assignment_overrides').select('assignment_id').eq('student_id', params.studentId).eq('excused', true).in('assignment_id', later)
      : { data: [] }
    const alreadyExcused = new Set((already ?? []).map((o: { assignment_id: string }) => o.assignment_id))
    const toExcuse = later.filter(id => !alreadyExcused.has(id))
    if (toExcuse.length > 0) {
      const { error } = await admin.from('assignment_overrides').upsert(
        toExcuse.map(assignment_id => ({ assignment_id, student_id: params.studentId, excused: true })),
        { onConflict: 'assignment_id,student_id' },
      )
      if (error) return { error: error.message }
    }
    const { error } = await admin
      .from('assignment_goal_claims')
      .update({ confirmed_at: new Date().toISOString(), confirmed_by: userId, excused_assignment_ids: toExcuse })
      .eq('id', claim.id)
    if (error) return { error: error.message }
    // Already-graded work only came back to the queue for this check: confirming clears it.
    // Work that was never graded stays in the queue for a normal Complete/Incomplete.
    await admin
      .from('submissions')
      .update({ status: 'graded' })
      .eq('assignment_id', params.assignmentId)
      .eq('student_id', params.studentId)
      .eq('status', 'submitted')
      .not('grade', 'is', null)
    revalidatePath(`/instructor/courses/${params.courseId}`, 'layout')
    revalidatePath(`/student/courses/${params.courseId}`, 'layout')
    return { excused: toExcuse.length }
  }

  const undo: string[] = claim.excused_assignment_ids ?? []
  if (undo.length > 0) {
    await admin.from('assignment_overrides').update({ excused: false }).eq('student_id', params.studentId).in('assignment_id', undo)
    // Rows that only existed for the excusal (no extension date) go away entirely.
    await admin.from('assignment_overrides').delete().eq('student_id', params.studentId).in('assignment_id', undo).is('due_date', null).eq('excused', false)
  }
  const { error } = await admin
    .from('assignment_goal_claims')
    .update({ confirmed_at: null, confirmed_by: null, excused_assignment_ids: [] })
    .eq('id', claim.id)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${params.courseId}`, 'layout')
  revalidatePath(`/student/courses/${params.courseId}`, 'layout')
  return { excused: 0 }
}

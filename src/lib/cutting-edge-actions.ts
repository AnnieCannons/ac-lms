'use server'

import { after } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import {
  canChangeRsvp,
  hasStarted,
  isCourseActiveAt,
  openTaskCount,
  validateEventInput,
  type CuttingEdgeEvent,
  type EventInput,
  type RsvpResponse,
} from '@/lib/cutting-edge'
import { EVENT_COLUMNS, loadLimitedCourseIds, loadStudentEvents, sendNewEventNotifications } from '@/lib/cutting-edge-server'

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const STAFF_ROLES = ['instructor', 'staff', 'admin']

/** Instructors, staff and admins may create/edit events. TAs may not. */
async function requireEventEditor(): Promise<{ userId: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return STAFF_ROLES.includes(profile?.role ?? '') ? { userId: user.id } : null
}

function eventRow(input: EventInput) {
  return {
    title: input.title.trim(),
    speaker: input.speaker.trim() || null,
    starts_at: new Date(input.startsAt).toISOString(),
    block: input.block || null,
    location_text: input.locationText.trim() || null,
    location_url: input.locationUrl.trim() || null,
    about_html: input.aboutHtml || null,
    audience_all: input.audienceAll,
    question_due_date: input.questionDueDate,
    question_html: input.questionHtml || null,
    question_padlet_url: input.questionPadletUrl.trim() || null,
    thanks_due_date: input.thanksDueDate,
    thanks_html: input.thanksHtml || null,
    thanks_padlet_url: input.thanksPadletUrl.trim() || null,
    updated_at: new Date().toISOString(),
  }
}

async function replaceCourses(admin: ReturnType<typeof createServiceSupabaseClient>, eventId: string, input: EventInput) {
  await admin.from('cutting_edge_event_courses').delete().eq('event_id', eventId)
  if (!input.audienceAll && input.courseIds.length > 0) {
    const { error } = await admin.from('cutting_edge_event_courses')
      .insert([...new Set(input.courseIds)].map(course_id => ({ event_id: eventId, course_id })))
    if (error) throw new Error(error.message)
  }
}

export async function saveCuttingEdgeEvent(eventId: string | null, input: EventInput): Promise<Result<{ id: string }>> {
  const editor = await requireEventEditor()
  if (!editor) return { ok: false, error: 'Not authorized.' }
  const invalid = validateEventInput(input)
  if (invalid) return { ok: false, error: invalid }

  const admin = createServiceSupabaseClient()
  try {
    if (eventId) {
      const { error } = await admin.from('cutting_edge_events').update(eventRow(input)).eq('id', eventId).is('deleted_at', null)
      if (error) return { ok: false, error: error.message }
      await replaceCourses(admin, eventId, input)
      return { ok: true, id: eventId }
    }
    const { data, error } = await admin.from('cutting_edge_events')
      .insert({ ...eventRow(input), status: 'draft', created_by: editor.userId })
      .select('id').single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Could not create the event.' }
    await replaceCourses(admin, data.id, input)
    return { ok: true, id: data.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not save the event.' }
  }
}

/**
 * Publishing makes the event visible to students. The first publish also sends the RSVP
 * prompt (bell + Slack) — after the response, so a big audience doesn't hold up the page —
 * unless `notify` is false (testing, or a talk students already know about). Either way the
 * first publish is recorded, so later re-publishes never send the prompt.
 */
export async function setCuttingEdgeEventPublished(eventId: string, published: boolean, notify = true): Promise<Result> {
  const editor = await requireEventEditor()
  if (!editor) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()

  const { data: event } = await admin.from('cutting_edge_events').select('id, first_published_at, deleted_at').eq('id', eventId).single()
  if (!event || event.deleted_at) return { ok: false, error: 'Event not found.' }

  const firstPublish = published && !event.first_published_at
  const { error } = await admin.from('cutting_edge_events').update({
    status: published ? 'published' : 'draft',
    ...(firstPublish ? { first_published_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', eventId)
  if (error) return { ok: false, error: error.message }

  if (firstPublish && notify) {
    after(async () => {
      try {
        await sendNewEventNotifications(createServiceSupabaseClient(), eventId)
      } catch (e) {
        console.error('cutting-edge: new event notifications failed', e)
      }
    })
  }
  return { ok: true }
}

export async function deleteCuttingEdgeEvent(eventId: string): Promise<Result> {
  const editor = await requireEventEditor()
  if (!editor) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()
  const { error } = await admin.from('cutting_edge_events').update({ deleted_at: new Date().toISOString() }).eq('id', eventId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Student actions ─────────────────────────────────────────────────────────────────────

/**
 * The caller must be a real student enrolled in `courseId`, and the event must be
 * published and include that course. Instructors previewing and admins viewing as a
 * student aren't enrolled as students, so they're rejected here — nothing is recorded.
 */
async function requireStudentForEvent(courseId: string, eventId: string): Promise<
  { ok: true; userId: string; event: CuttingEdgeEvent; admin: ReturnType<typeof createServiceSupabaseClient> } | { ok: false; error: string }
> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const admin = createServiceSupabaseClient()
  const { data: enrollment } = await admin.from('course_enrollments').select('role')
    .eq('user_id', user.id).eq('course_id', courseId).eq('role', 'student').maybeSingle()
  if (!enrollment) return { ok: false, error: 'Only enrolled students can RSVP.' }

  const { data: event } = await admin.from('cutting_edge_events').select(EVENT_COLUMNS).eq('id', eventId).single()
  if (!event || event.deleted_at || event.status !== 'published') return { ok: false, error: 'Event not found.' }

  if (!(await courseInAudience(admin, event as CuttingEdgeEvent, courseId))) return { ok: false, error: 'Event not found.' }
  return { ok: true, userId: user.id, event: event as CuttingEdgeEvent, admin }
}

async function courseInAudience(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  event: CuttingEdgeEvent,
  courseId: string,
): Promise<boolean> {
  if (!event.audience_all) return (await loadLimitedCourseIds(admin, event.id)).includes(courseId)
  const { data: course } = await admin.from('courses').select('start_date, end_date').eq('id', courseId).single()
  if (!course) return false
  const now = new Date()
  const startsAt = new Date(event.starts_at)
  return isCourseActiveAt(course, startsAt) || (startsAt > now && isCourseActiveAt(course, now))
}

async function upsertOwn(admin: ReturnType<typeof createServiceSupabaseClient>, eventId: string, userId: string, patch: Record<string, unknown>): Promise<Result> {
  const { error } = await admin.from('cutting_edge_rsvps').upsert(
    { event_id: eventId, user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'event_id,user_id' },
  )
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function setMyCuttingEdgeRsvp(courseId: string, eventId: string, response: RsvpResponse): Promise<Result> {
  if (response !== 'yes' && response !== 'no') return { ok: false, error: 'Invalid RSVP.' }
  const ctx = await requireStudentForEvent(courseId, eventId)
  if (!ctx.ok) return ctx
  if (!canChangeRsvp(ctx.event, new Date())) {
    return { ok: false, error: 'RSVPs are closed — the talk has started. If you said yes and couldn’t make it, check “I did not make it” on the thank-you.' }
  }
  return upsertOwn(ctx.admin, eventId, ctx.userId, { response })
}

export async function setMyCuttingEdgeQuestionDone(courseId: string, eventId: string, done: boolean): Promise<Result> {
  const ctx = await requireStudentForEvent(courseId, eventId)
  if (!ctx.ok) return ctx
  return upsertOwn(ctx.admin, eventId, ctx.userId, { question_done_at: done ? new Date().toISOString() : null })
}

/** "done" and "missed" are mutually exclusive; null clears both. Only after the talk starts. */
export async function setMyCuttingEdgeThanks(courseId: string, eventId: string, state: 'done' | 'missed' | null): Promise<Result> {
  if (state !== 'done' && state !== 'missed' && state !== null) return { ok: false, error: 'Invalid state.' }
  const ctx = await requireStudentForEvent(courseId, eventId)
  if (!ctx.ok) return ctx
  if (!hasStarted(ctx.event, new Date())) return { ok: false, error: 'The thank-you opens once the talk has happened.' }
  const now = new Date().toISOString()
  return upsertOwn(ctx.admin, eventId, ctx.userId, {
    thanks_done_at: state === 'done' ? now : null,
    missed_at: state === 'missed' ? now : null,
  })
}

/** The nav's "Tasks due" badge: the signed-in student's open Cutting Edge tasks via this course. */
export async function getMyCuttingEdgeTaskCount(courseId: string): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const admin = createServiceSupabaseClient()
  const { data: enrollment } = await admin.from('course_enrollments').select('role')
    .eq('user_id', user.id).eq('course_id', courseId).eq('role', 'student').maybeSingle()
  if (!enrollment) return 0
  try {
    const now = new Date()
    return openTaskCount(await loadStudentEvents(admin, courseId, user.id, now), now)
  } catch {
    return 0
  }
}

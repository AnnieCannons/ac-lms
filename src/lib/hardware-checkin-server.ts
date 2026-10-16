import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { loadPeople, type Person } from '@/lib/hardware-server'
import { planCheckin, type CheckinPlan, type CheckinResponse, type DeviceMatch } from '@/lib/hardware-checkin'

// Server-only loaders for the equipment check-in. Callers check access first; student
// loaders take the signed-in user's own id (from auth), never one from the request.

type Admin = ReturnType<typeof createServiceSupabaseClient>

export type Checkin = { id: string; title: string; created_at: string; closed_at: string | null }

/** The newest open check-in the student was sent, with their answers so far. */
export async function loadMyOpenCheckin(admin: Admin, userId: string): Promise<{ survey: Checkin; response: CheckinResponse | null } | null> {
  const { data: mine } = await admin.from('hardware_survey_recipients').select('survey_id').eq('user_id', userId)
  const ids = ((mine ?? []) as { survey_id: string }[]).map(r => r.survey_id)
  if (ids.length === 0) return null
  const { data: survey } = await admin.from('hardware_surveys').select('id, title, created_at, closed_at')
    .in('id', ids).is('closed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!survey) return null
  const { data: response } = await admin.from('hardware_survey_responses').select('*')
    .eq('survey_id', survey.id).eq('user_id', userId).maybeSingle()
  return { survey: survey as Checkin, response: (response as CheckinResponse | null) ?? null }
}

/** Does this student still need to fill in a check-in? (For banners.) */
export async function hasUnansweredCheckin(admin: Admin, userId: string): Promise<boolean> {
  const open = await loadMyOpenCheckin(admin, userId)
  return !!open && !open.response
}

export type CheckinSummary = Checkin & { sent: number; answered: number; toReview: number }

export async function loadCheckins(admin: Admin): Promise<CheckinSummary[]> {
  const { data } = await admin.from('hardware_surveys').select('id, title, created_at, closed_at').order('created_at', { ascending: false })
  const surveys = (data as Checkin[] | null) ?? []
  if (surveys.length === 0) return []
  const ids = surveys.map(s => s.id)
  const [recipients, responses] = await Promise.all([
    fetchAllRows<{ survey_id: string }>((from, to) =>
      admin.from('hardware_survey_recipients').select('survey_id').in('survey_id', ids).range(from, to) as unknown as PromiseLike<{ data: { survey_id: string }[] | null; error: { message: string } | null }>),
    fetchAllRows<{ survey_id: string; review_status: string }>((from, to) =>
      admin.from('hardware_survey_responses').select('survey_id, review_status').in('survey_id', ids).range(from, to) as unknown as PromiseLike<{ data: { survey_id: string; review_status: string }[] | null; error: { message: string } | null }>),
  ])
  return surveys.map(s => ({
    ...s,
    sent: recipients.filter(r => r.survey_id === s.id).length,
    answered: responses.filter(r => r.survey_id === s.id).length,
    toReview: responses.filter(r => r.survey_id === s.id && r.review_status === 'pending').length,
  }))
}

export type ReviewItem = { response: CheckinResponse; student: Person; plan: CheckinPlan }
export type CheckinDetail = {
  survey: Checkin
  toReview: ReviewItem[]
  reviewed: { response: CheckinResponse; student: Person }[]
  notAnswered: { student: Person; lastNudgedAt: string | null; courseName: string | null }[]
}

export async function loadCheckinDetail(admin: Admin, surveyId: string): Promise<CheckinDetail | null> {
  const { data: survey } = await admin.from('hardware_surveys').select('id, title, created_at, closed_at').eq('id', surveyId).maybeSingle()
  if (!survey) return null

  const [recipients, responses, devices] = await Promise.all([
    fetchAllRows<{ user_id: string; course_id: string | null; last_nudged_at: string | null }>((from, to) =>
      admin.from('hardware_survey_recipients').select('user_id, course_id, last_nudged_at').eq('survey_id', surveyId).range(from, to) as unknown as PromiseLike<{ data: { user_id: string; course_id: string | null; last_nudged_at: string | null }[] | null; error: { message: string } | null }>),
    fetchAllRows<CheckinResponse>((from, to) =>
      admin.from('hardware_survey_responses').select('*').eq('survey_id', surveyId).order('submitted_at').range(from, to) as unknown as PromiseLike<{ data: CheckinResponse[] | null; error: { message: string } | null }>),
    fetchAllRows<DeviceMatch>((from, to) =>
      admin.from('hardware_devices').select('id, asset_tag, kind, status, current_holder_id, serial_number, imei, phone_number').range(from, to) as unknown as PromiseLike<{ data: DeviceMatch[] | null; error: { message: string } | null }>),
  ])
  const pendingIds = responses.filter(r => r.review_status === 'pending').map(r => r.user_id)
  const [people, { data: reps }, { data: courses }] = await Promise.all([
    loadPeople(admin, recipients.map(r => r.user_id)),
    pendingIds.length
      ? admin.from('hardware_replacements').select('student_id, kind').in('student_id', pendingIds)
      : Promise.resolve({ data: [] }),
    admin.from('courses').select('id, name').in('id', [...new Set(recipients.map(r => r.course_id).filter((id): id is string => !!id))]),
  ])
  const courseName = new Map(((courses ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]))
  const person = (id: string): Person => people.get(id) ?? { id, name: null, email: '' }
  const replacementsFor = (id: string) => {
    const kinds = ((reps ?? []) as { student_id: string; kind: string }[]).filter(r => r.student_id === id).map(r => r.kind)
    return { laptop: kinds.filter(k => k === 'laptop').length, charger: kinds.filter(k => k === 'charger').length }
  }
  const byName = (a: { student: Person }, b: { student: Person }) => (a.student.name ?? a.student.email).localeCompare(b.student.name ?? b.student.email)
  const answered = new Set(responses.map(r => r.user_id))

  return {
    survey: survey as Checkin,
    toReview: responses.filter(r => r.review_status === 'pending')
      .map(r => ({ response: r, student: person(r.user_id), plan: planCheckin(r, devices, replacementsFor(r.user_id)) })),
    reviewed: responses.filter(r => r.review_status !== 'pending').map(r => ({ response: r, student: person(r.user_id) })).sort(byName),
    notAnswered: recipients.filter(r => !answered.has(r.user_id))
      .map(r => ({ student: person(r.user_id), lastNudgedAt: r.last_nudged_at, courseName: r.course_id ? courseName.get(r.course_id) ?? null : null }))
      .sort(byName),
  }
}

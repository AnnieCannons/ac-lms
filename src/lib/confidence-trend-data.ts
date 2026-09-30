// Data loaders for the Confidence Tracker v2 trend pages (Phase 4).
//
// Deliberately NOT a 'use server' module: exporting these as server actions would make them
// callable endpoints. They are only called from server pages, and loadCourseTrend must only
// be called after the page has verified admin/instructor/staff access (it uses the
// service-role client, which bypasses RLS).

import type { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import {
  buildSkillTrends,
  computeClassStats,
  latestRatingsBySkill,
  type AssignmentInfo,
  type ClassStats,
  type EventRow,
  type GoalRow,
  type OutcomeRow,
  type ProgressRow,
  type RatingRow,
  type SkillMeta,
  type SkillTrend,
} from '@/lib/confidence-trend'

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>
type ServiceClient = ReturnType<typeof createServiceSupabaseClient>
type AnyClient = ServerClient | ServiceClient

const CHUNK = 100

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined)

interface RatingDbRow { id: string; student_id: string; skill_id: string; rating: number; created_at: string; assignment_id: string }
interface GoalDbRow { id: string; student_id: string; skill_id: string; goal: number | null; goal_is_maintain: boolean; target_date: string | null; study_plan: string[] | null; study_plan_other: string | null; created_at: string }
interface EventDbRow { student_id: string; skill_id: string; event_type: 'mastered' | 'reactivated'; created_at: string }
interface OutcomeDbRow { id: string; goal_history_id: string; student_id: string; skill_id: string; met_at: string; met_rating: number; what_helped: string[] | null; what_helped_other: string | null; answered_at: string | null }
interface ProgressDbRow { student_id: string; skill_id: string; is_mastered: boolean; is_new_pending: boolean }

const toOutcome = (o: OutcomeDbRow): OutcomeRow => ({
  id: o.id, goalHistoryId: o.goal_history_id, skillId: o.skill_id, metAt: o.met_at, metRating: o.met_rating,
  whatHelped: o.what_helped, whatHelpedOther: o.what_helped_other, answeredAt: o.answered_at,
})
const toGoal = (g: GoalDbRow): GoalRow => ({
  id: g.id, skillId: g.skill_id, goal: g.goal, goalIsMaintain: g.goal_is_maintain, targetDate: g.target_date,
  studyPlan: g.study_plan, studyPlanOther: g.study_plan_other, createdAt: g.created_at,
})
const toEvent = (e: EventDbRow): EventRow => ({ skillId: e.skill_id, eventType: e.event_type, createdAt: e.created_at })
const toProgress = (p: ProgressDbRow): ProgressRow => ({ skillId: p.skill_id, isMastered: p.is_mastered, isNewPending: p.is_new_pending })
const toRating = (r: RatingDbRow): RatingRow => ({ id: r.id, skillId: r.skill_id, rating: r.rating, createdAt: r.created_at, assignmentId: r.assignment_id })

async function loadSkills(client: AnyClient, skillIds: string[]): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = []
  for (const ids of chunk(skillIds)) {
    const { data, error } = await client.from('confidence_tracker_skills').select('id, name').in('id', ids)
    if (error) throw new Error(error.message)
    skills.push(...((data ?? []) as SkillMeta[]))
  }
  return skills
}

// An assignment's course is derived through module_day -> module (assignments has no
// course_id; linked_day_id is only a display cross-post). Soft-deleted rows are NOT filtered
// out so a rating on a since-removed assignment still resolves; a missing chain yields nulls.
async function loadAssignmentInfo(service: ServiceClient, assignmentIds: string[]): Promise<Record<string, AssignmentInfo>> {
  const info: Record<string, AssignmentInfo> = {}
  for (const ids of chunk([...new Set(assignmentIds)])) {
    const { data, error } = await service
      .from('assignments')
      .select('id, title, module_days!module_day_id(modules(course_id, courses(name)))')
      .in('id', ids)
    if (error) throw new Error(error.message)
    for (const a of (data ?? []) as unknown as { id: string; title: string | null; module_days: unknown }[]) {
      const md = one(a.module_days as { modules?: unknown } | { modules?: unknown }[] | null)
      const mod = one(md?.modules as { course_id: string; courses?: unknown } | { course_id: string; courses?: unknown }[] | null)
      const course = one(mod?.courses as { name: string } | { name: string }[] | null)
      info[a.id] = { title: a.title ?? null, courseId: mod?.course_id ?? null, courseName: course?.name ?? null }
    }
  }
  return info
}

async function fetchByStudentsAndSkills<T>(
  client: AnyClient, table: string, columns: string, studentIds: string[], skillIds: string[], ordered = false
): Promise<T[]> {
  const rows: T[] = []
  for (const students of chunk(studentIds)) {
    for (const skills of chunk(skillIds)) {
      rows.push(...await fetchAllRows<T>((from, to) => {
        let q = client.from(table).select(columns).in('student_id', students).in('skill_id', skills)
        if (ordered) q = q.order('created_at').order('id')
        return q.range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>
      }))
    }
  }
  return rows
}

// The student's own trends, across every course. `supabase` is the RLS-scoped client, so a
// student can only ever load their own rows; `service` is used only to look up assignment
// titles and course names for ids that came from those rows.
export async function loadStudentTrend(supabase: ServerClient, service: ServiceClient, studentId: string): Promise<SkillTrend[]> {
  const ratingRows = await fetchAllRows<RatingDbRow>((from, to) =>
    supabase
      .from('confidence_tracker_ratings')
      .select('id, student_id, skill_id, rating, created_at, assignment_id')
      .eq('student_id', studentId)
      .order('created_at')
      .order('id')
      .range(from, to) as unknown as PromiseLike<{ data: RatingDbRow[] | null; error: { message: string } | null }>
  )
  if (ratingRows.length === 0) return []

  const skillIds = [...new Set(ratingRows.map(r => r.skill_id))]
  const [skills, progress, goals, events, outcomes, assignments] = await Promise.all([
    loadSkills(supabase, skillIds),
    fetchByStudentsAndSkills<ProgressDbRow>(supabase, 'confidence_tracker_skill_progress', 'student_id, skill_id, is_mastered, is_new_pending', [studentId], skillIds),
    fetchByStudentsAndSkills<GoalDbRow>(supabase, 'confidence_tracker_goal_history', 'id, student_id, skill_id, goal, goal_is_maintain, target_date, study_plan, study_plan_other, created_at', [studentId], skillIds),
    fetchByStudentsAndSkills<EventDbRow>(supabase, 'confidence_tracker_skill_events', 'student_id, skill_id, event_type, created_at', [studentId], skillIds),
    fetchByStudentsAndSkills<OutcomeDbRow>(supabase, 'confidence_tracker_goal_outcomes', 'id, goal_history_id, student_id, skill_id, met_at, met_rating, what_helped, what_helped_other, answered_at', [studentId], skillIds),
    loadAssignmentInfo(service, ratingRows.map(r => r.assignment_id)),
  ])

  return buildSkillTrends({
    skills,
    ratings: ratingRows.map(toRating),
    assignments,
    goals: goals.map(toGoal),
    events: events.map(toEvent),
    progress: progress.map(toProgress),
    outcomes: outcomes.map(toOutcome),
  })
}

export interface CourseTrendStudent {
  id: string
  name: string
  trends: SkillTrend[]
}

export interface CourseTrendSkill {
  id: string
  name: string
  stats: ClassStats
}

export interface CourseTrendData {
  students: CourseTrendStudent[]
  skills: CourseTrendSkill[]
}

// Caller MUST have verified admin/instructor/staff access first (TAs excluded).
export async function loadCourseTrend(service: ServiceClient, courseId: string): Promise<CourseTrendData> {
  // Currently active students only — the same filter the gradebook uses (role = 'student').
  const { data: enrollments, error: enrollError } = await service
    .from('course_enrollments')
    .select('user_id, users(id, name)')
    .eq('course_id', courseId)
    .eq('role', 'student')
  if (enrollError) throw new Error(enrollError.message)
  const roster = (enrollments ?? []).map(e => {
    const u = one(e.users as { id: string; name: string | null } | { id: string; name: string | null }[] | null)
    return { id: e.user_id as string, name: u?.name ?? 'Unknown' }
  }).sort((a, b) => a.name.localeCompare(b.name))

  // Skills tagged on this course's active assignments (module -> day -> assignment, all not deleted).
  const { data: modules, error: modError } = await service
    .from('modules').select('id').eq('course_id', courseId).is('deleted_at', null)
  if (modError) throw new Error(modError.message)
  const dayIds: string[] = []
  for (const ids of chunk((modules ?? []).map(m => m.id as string))) {
    const { data, error } = await service.from('module_days').select('id').in('module_id', ids).is('deleted_at', null)
    if (error) throw new Error(error.message)
    dayIds.push(...(data ?? []).map(d => d.id as string))
  }
  const assignmentIds: string[] = []
  for (const ids of chunk(dayIds)) {
    const { data, error } = await service.from('assignments').select('id').in('module_day_id', ids).is('deleted_at', null)
    if (error) throw new Error(error.message)
    assignmentIds.push(...(data ?? []).map(a => a.id as string))
  }
  const taggedSkillIds = new Set<string>()
  for (const ids of chunk(assignmentIds)) {
    const { data, error } = await service.from('confidence_tracker_assignment_skills').select('skill_id').in('assignment_id', ids)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) taggedSkillIds.add(row.skill_id as string)
  }

  const students: CourseTrendStudent[] = roster.map(s => ({ ...s, trends: [] }))
  if (roster.length === 0 || taggedSkillIds.size === 0) return { students, skills: [] }

  const studentIds = roster.map(s => s.id)
  const skillIds = [...taggedSkillIds]

  // One query returns this course's ratings AND each student's earlier-course ratings of the
  // same skills; they are told apart by course below.
  const ratingRows = await fetchByStudentsAndSkills<RatingDbRow>(
    service, 'confidence_tracker_ratings', 'id, student_id, skill_id, rating, created_at, assignment_id', studentIds, skillIds, true
  )
  const [skills, progress, goals, events, outcomes, assignments] = await Promise.all([
    loadSkills(service, skillIds),
    fetchByStudentsAndSkills<ProgressDbRow>(service, 'confidence_tracker_skill_progress', 'student_id, skill_id, is_mastered, is_new_pending', studentIds, skillIds),
    fetchByStudentsAndSkills<GoalDbRow>(service, 'confidence_tracker_goal_history', 'id, student_id, skill_id, goal, goal_is_maintain, target_date, study_plan, study_plan_other, created_at', studentIds, skillIds),
    fetchByStudentsAndSkills<EventDbRow>(service, 'confidence_tracker_skill_events', 'student_id, skill_id, event_type, created_at', studentIds, skillIds),
    fetchByStudentsAndSkills<OutcomeDbRow>(service, 'confidence_tracker_goal_outcomes', 'id, goal_history_id, student_id, skill_id, met_at, met_rating, what_helped, what_helped_other, answered_at', studentIds, skillIds),
    loadAssignmentInfo(service, ratingRows.map(r => r.assignment_id)),
  ])

  for (const student of students) {
    student.trends = buildSkillTrends({
      skills,
      ratings: ratingRows.filter(r => r.student_id === student.id).map(toRating),
      assignments,
      goals: goals.filter(g => g.student_id === student.id).map(toGoal),
      events: events.filter(e => e.student_id === student.id).map(toEvent),
      progress: progress.filter(p => p.student_id === student.id).map(toProgress),
      outcomes: outcomes.filter(o => o.student_id === student.id).map(toOutcome),
      currentCourseId: courseId,
    })
  }

  // Class overview uses only this course's ratings — earlier-course ratings are drill-in context.
  const latestBySkill = latestRatingsBySkill(
    ratingRows
      .filter(r => assignments[r.assignment_id]?.courseId === courseId)
      .map(r => ({ id: r.id, studentId: r.student_id, skillId: r.skill_id, rating: r.rating, createdAt: r.created_at }))
  )
  const courseSkills: CourseTrendSkill[] = skills
    .filter(s => (latestBySkill[s.id]?.length ?? 0) > 0)
    .map(s => ({ id: s.id, name: s.name, stats: computeClassStats(latestBySkill[s.id]) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { students, skills: courseSkills }
}

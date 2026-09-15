'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isDueThisWeek } from '@/lib/date-utils'
import { toEtDateStr } from '@/lib/weekly-report'

export type AssignmentBucket = 'complete' | 'waiting-to-be-graded' | 'needs-revision' | 'missing' | 'due-this-week' | 'excused'

export type AssignmentStat = {
  id: string
  title: string
  due_date: string | null
  module_title: string | null
  submission_id: string | null
  comment_count: number
}

export type StudentAssignmentStats = {
  complete: AssignmentStat[]
  waitingToBeGraded: AssignmentStat[]
  needsRevision: AssignmentStat[]
  missing: AssignmentStat[]
  dueThisWeek: AssignmentStat[]
  excused: AssignmentStat[]
}

export async function getStudentAssignmentStats(
  studentId: string,
  courseId: string,
): Promise<StudentAssignmentStats> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  return computeStudentAssignmentStats(createServiceSupabaseClient(), studentId, courseId)
}

export type StatsHistoryPoint = { weekStart: string; missing: number; needsRevision: number }

export async function getStudentStatsHistory(studentId: string, courseId: string): Promise<StatsHistoryPoint[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  const admin = createServiceSupabaseClient()
  const { data } = await admin
    .from('student_stats_snapshots')
    .select('week_start, missing_count, needs_revision_count')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .order('week_start', { ascending: true })

  type Row = { week_start: string; missing_count: number; needs_revision_count: number }
  return ((data as Row[]) ?? []).map(r => ({
    weekStart: r.week_start,
    missing: r.missing_count,
    needsRevision: r.needs_revision_count,
  }))
}

type CourseAssignment = Omit<AssignmentStat, 'submission_id' | 'comment_count'> & { submission_required: boolean }

// Fetch all published, non-deleted assignments for this course that require submission
async function fetchCourseAssignments(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  courseId: string,
): Promise<CourseAssignment[]> {
  const { data: modules } = await admin
    .from('modules')
    .select('title, module_days(assignments!module_day_id(id, title, due_date, submission_required, deleted_at, published))')
    .eq('course_id', courseId)
    .eq('published', true)
    .is('deleted_at', null)

  type RawAssignment = { id: string; title: string; due_date: string | null; submission_required: boolean; deleted_at: string | null; published: boolean }
  type RawDay = { assignments: RawAssignment[] }
  type RawModule = { title: string; module_days: RawDay[] }

  const assignments: CourseAssignment[] = []
  for (const m of (modules as RawModule[] ?? [])) {
    for (const d of m.module_days ?? []) {
      for (const a of d.assignments ?? []) {
        if (!a.published || a.deleted_at || a.submission_required === false) continue
        assignments.push({ id: a.id, title: a.title, due_date: a.due_date, module_title: m.title, submission_required: a.submission_required })
      }
    }
  }
  return assignments
}

/**
 * Counts how many times this student had a submission returned as Needs
 * Revision (grade_history rows with grade='incomplete') within [weekStart,
 * weekEnd] (ET calendar dates, inclusive) -- every bounce counts, not just
 * whatever is still sitting in that state as of when this is called. This is
 * what feeds the weekly readiness score, replacing the old Monday-morning
 * snapshot of current state.
 */
export async function countNeedsRevisionEvents(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  studentId: string,
  courseId: string,
  weekStart: string,
  weekEnd: string,
): Promise<number> {
  const assignments = await fetchCourseAssignments(admin, courseId)
  if (assignments.length === 0) return 0

  const { data: submissions } = await admin
    .from('submissions')
    .select('id')
    .eq('student_id', studentId)
    .in('assignment_id', assignments.map(a => a.id))

  const submissionIds = (submissions as { id: string }[] ?? []).map(s => s.id)
  if (submissionIds.length === 0) return 0

  const { data: historyRows } = await admin
    .from('grade_history')
    .select('graded_at')
    .in('submission_id', submissionIds)
    .eq('grade', 'incomplete')

  return ((historyRows as { graded_at: string }[]) ?? []).filter(r => {
    const etDate = toEtDateStr(new Date(r.graded_at))
    return etDate >= weekStart && etDate <= weekEnd
  }).length
}

export async function computeStudentAssignmentStats(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  studentId: string,
  courseId: string,
): Promise<StudentAssignmentStats> {
  const assignments = await fetchCourseAssignments(admin, courseId)

  if (assignments.length === 0) {
    return { complete: [], waitingToBeGraded: [], needsRevision: [], missing: [], dueThisWeek: [], excused: [] }
  }

  // Fetch this student's submissions and per-student overrides for these assignments
  const assignmentIds = assignments.map(a => a.id)
  const [{ data: submissions }, { data: overrideRows }] = await Promise.all([
    admin
      .from('submissions')
      .select('id, assignment_id, status, grade, submitted_at')
      .eq('student_id', studentId)
      .in('assignment_id', assignmentIds),
    admin
      .from('assignment_overrides')
      .select('assignment_id, due_date, excused')
      .eq('student_id', studentId)
      .in('assignment_id', assignmentIds),
  ])

  type Sub = { id: string; assignment_id: string; status: string; grade: string | null; submitted_at: string | null }
  const subMap = new Map<string, Sub>()
  for (const s of (submissions as Sub[] ?? [])) {
    subMap.set(s.assignment_id, s)
  }

  const submissionIds = (submissions as Sub[] ?? []).map(s => s.id)
  const commentCountMap = new Map<string, number>()
  if (submissionIds.length > 0) {
    const { data: commentRows } = await admin
      .from('submission_comments')
      .select('submission_id')
      .in('submission_id', submissionIds)
    for (const c of (commentRows as { submission_id: string }[] ?? [])) {
      commentCountMap.set(c.submission_id, (commentCountMap.get(c.submission_id) ?? 0) + 1)
    }
  }

  type Override = { assignment_id: string; due_date: string | null; excused: boolean }
  const overrideMap = new Map<string, Override>()
  for (const o of (overrideRows as Override[] ?? [])) {
    overrideMap.set(o.assignment_id, o)
  }

  const now = new Date()
  const complete: AssignmentStat[] = []
  const waitingToBeGraded: AssignmentStat[] = []
  const needsRevision: AssignmentStat[] = []
  const missing: AssignmentStat[] = []
  const dueThisWeek: AssignmentStat[] = []
  const excused: AssignmentStat[] = []

  for (const a of assignments) {
    const sub = subMap.get(a.id)
    const override = overrideMap.get(a.id)
    const effectiveDueDate = override?.due_date ?? a.due_date
    const stat: AssignmentStat = {
      id: a.id,
      title: a.title,
      due_date: effectiveDueDate,
      module_title: a.module_title,
      submission_id: sub?.id ?? null,
      comment_count: sub ? (commentCountMap.get(sub.id) ?? 0) : 0,
    }

    if (override?.excused) {
      excused.push(stat)
      continue
    }

    if (sub?.grade === 'complete') {
      complete.push(stat)
    } else if (sub?.grade === 'incomplete') {
      needsRevision.push(stat)
    } else if (sub?.status === 'submitted' || sub?.status === 'graded') {
      waitingToBeGraded.push(stat)
    } else {
      // No submission or draft
      const isPastDue = !!effectiveDueDate && new Date(effectiveDueDate) < now
      if (isPastDue) {
        missing.push(stat)
      } else if (isDueThisWeek(effectiveDueDate)) {
        // Only flag as "Due this week" once it's actually due this calendar
        // week — not everything unsubmitted for the rest of the course.
        dueThisWeek.push(stat)
      }
    }
  }

  return { complete, waitingToBeGraded, needsRevision, missing, dueThisWeek, excused }
}

'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AssignmentBucket = 'complete' | 'turned-in' | 'missing' | 'not-started'

export type AssignmentStat = {
  id: string
  title: string
  due_date: string | null
  module_title: string | null
}

export type StudentAssignmentStats = {
  complete: AssignmentStat[]
  turnedIn: AssignmentStat[]
  missing: AssignmentStat[]
  notStarted: AssignmentStat[]
}

export async function getStudentAssignmentStats(
  studentId: string,
  courseId: string,
): Promise<StudentAssignmentStats> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    throw new Error('Forbidden')
  }

  const admin = createServiceSupabaseClient()

  // Fetch all published, non-deleted assignments for this course that require submission
  const { data: modules } = await admin
    .from('modules')
    .select('title, module_days(assignments!module_day_id(id, title, due_date, submission_required, deleted_at, published))')
    .eq('course_id', courseId)
    .eq('published', true)
    .is('deleted_at', null)

  type RawAssignment = { id: string; title: string; due_date: string | null; submission_required: boolean; deleted_at: string | null; published: boolean }
  type RawDay = { assignments: RawAssignment[] }
  type RawModule = { title: string; module_days: RawDay[] }

  const assignments: (AssignmentStat & { submission_required: boolean })[] = []
  for (const m of (modules as RawModule[] ?? [])) {
    for (const d of m.module_days ?? []) {
      for (const a of d.assignments ?? []) {
        if (!a.published || a.deleted_at || a.submission_required === false) continue
        assignments.push({ id: a.id, title: a.title, due_date: a.due_date, module_title: m.title, submission_required: a.submission_required })
      }
    }
  }

  if (assignments.length === 0) {
    return { complete: [], turnedIn: [], missing: [], notStarted: [] }
  }

  // Fetch this student's submissions for these assignments
  const assignmentIds = assignments.map(a => a.id)
  const { data: submissions } = await admin
    .from('submissions')
    .select('assignment_id, status, grade, submitted_at')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds)

  type Sub = { assignment_id: string; status: string; grade: string | null; submitted_at: string | null }
  const subMap = new Map<string, Sub>()
  for (const s of (submissions as Sub[] ?? [])) {
    subMap.set(s.assignment_id, s)
  }

  const now = new Date()
  const complete: AssignmentStat[] = []
  const turnedIn: AssignmentStat[] = []
  const missing: AssignmentStat[] = []
  const notStarted: AssignmentStat[] = []

  for (const a of assignments) {
    const sub = subMap.get(a.id)
    const stat: AssignmentStat = { id: a.id, title: a.title, due_date: a.due_date, module_title: a.module_title }

    if (sub?.grade === 'complete') {
      complete.push(stat)
    } else if (sub?.grade === 'incomplete') {
      // treat needs-revision as turned in (awaiting resubmit)
      turnedIn.push(stat)
    } else if (sub?.status === 'submitted' || sub?.status === 'graded') {
      turnedIn.push(stat)
    } else {
      // No submission or draft
      const isPastDue = !!a.due_date && new Date(a.due_date) < now
      if (isPastDue) {
        missing.push(stat)
      } else {
        notStarted.push(stat)
      }
    }
  }

  return { complete, turnedIn, missing, notStarted }
}

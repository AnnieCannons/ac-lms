'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getReadinessChain } from '@/lib/readiness-chain'
import { computeStudentAssignmentStats, type StudentAssignmentStats } from '@/lib/student-stats'

export type { AssignmentBucket, AssignmentStat, StudentAssignmentStats } from '@/lib/student-stats'

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
  const chain = await getReadinessChain(admin, courseId)
  const { data } = await admin
    .from('student_stats_snapshots')
    .select('week_start, missing_count, needs_revision_count')
    .eq('student_id', studentId)
    .in('course_id', chain)
    .order('week_start', { ascending: true })

  type Row = { week_start: string; missing_count: number; needs_revision_count: number }
  return ((data as Row[]) ?? []).map(r => ({
    weekStart: r.week_start,
    missing: r.missing_count,
    needsRevision: r.needs_revision_count,
  }))
}

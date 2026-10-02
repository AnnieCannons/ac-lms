// Server-side only — links a cohort's TCF and ITP courses into one readiness
// "chain". The ITP/TCF track is one 15-week program split across two Supabase
// course rows (a 4-week TCF phase, then an 11-week ITP phase); the readiness
// score, escalation process, and check-ins carry over from TCF into ITP rather
// than starting fresh. Every other track is a single course, so its chain is
// just itself.

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { detectTrack, extractCohortTag } from '@/lib/weekly-report'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

export type ChainCourse = {
  id: string
  name: string
  start_date: string | null
  is_template: boolean | null
  airtable_course_name: string | null
}

/**
 * The course this one continues from: the same-track, same-cohort-tag
 * ("(Sept 2026)") course that started before it. Only the ITP/TCF track
 * chains. Archived courses still count -- a finished TCF course may get
 * archived while its ITP course is still running.
 */
export function findPredecessorCourse<T extends ChainCourse>(course: T, allCourses: T[]): T | null {
  if (course.is_template || !course.start_date) return null
  if (detectTrack(course.name, course.airtable_course_name) !== 'itp_tcf') return null
  const tag = extractCohortTag(course.name)
  if (!tag) return null

  const candidates = allCourses.filter(c =>
    c.id !== course.id &&
    !c.is_template &&
    !!c.start_date &&
    c.start_date < course.start_date! &&
    detectTrack(c.name, c.airtable_course_name) === 'itp_tcf' &&
    extractCohortTag(c.name) === tag,
  )
  return candidates.sort((a, b) => b.start_date!.localeCompare(a.start_date!))[0] ?? null
}

const CHAIN_COLUMNS = 'id, name, start_date, is_template, airtable_course_name'

/** The course this one continues from, or null (see findPredecessorCourse). */
export async function getPredecessorCourse(admin: AdminClient, courseId: string): Promise<ChainCourse | null> {
  const { data } = await admin.from('courses').select(CHAIN_COLUMNS)
  const all = (data as ChainCourse[] | null) ?? []
  const course = all.find(c => c.id === courseId)
  return course ? findPredecessorCourse(course, all) : null
}

/**
 * Course ids whose readiness data counts for this course, earliest first --
 * [tcfId, itpId] for an ITP course with a TCF predecessor, else [courseId].
 */
export async function getReadinessChain(admin: AdminClient, courseId: string): Promise<string[]> {
  const predecessor = await getPredecessorCourse(admin, courseId)
  return predecessor ? [predecessor.id, courseId] : [courseId]
}

/** Whether this student was enrolled as a student in the given course. */
export async function isEnrolledStudent(admin: AdminClient, studentId: string, courseId: string): Promise<boolean> {
  const { data } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('user_id', studentId)
    .eq('role', 'student')
    .limit(1)
  return !!(data && data.length > 0)
}

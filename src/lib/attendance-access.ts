// Server-side only — who may see which Airtable classes in the instructor
// Attendance portal. Instructors, staff and admins see every class; a TA only
// sees the classes linked to the courses they're a TA of.

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { resolveAirtableCourseName, type CourseRow } from '@/lib/weekly-report'

export type AttendanceAccess =
  | { allClasses: true }
  | { allClasses: false; classNames: string[] }

const TRUSTED_ROLES = ['instructor', 'staff', 'admin']

/** Returns null when the caller isn't signed in, or isn't staff or a TA anywhere. */
export async function getAttendanceAccess(): Promise<AttendanceAccess | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createServiceSupabaseClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role && TRUSTED_ROLES.includes(profile.role)) return { allClasses: true }

  const { data: taRows } = await admin
    .from('course_enrollments')
    .select('course_id')
    .eq('user_id', user.id)
    .eq('role', 'ta')
  if (!taRows || taRows.length === 0) return null

  // All courses are needed for the ITP/TCF sibling fallback in resolveAirtableCourseName.
  const { data: courses } = await admin
    .from('courses')
    .select('id, name, is_template, archived, airtable_course_name')
  const all = (courses ?? []) as (CourseRow & { id: string })[]
  const taCourseIds = new Set(taRows.map(r => r.course_id))

  const classNames = new Set<string>()
  for (const course of all) {
    if (!taCourseIds.has(course.id)) continue
    const name = resolveAirtableCourseName(course, all)
    if (name) classNames.add(name.trim())
  }
  return { allClasses: false, classNames: [...classNames] }
}

export function canSeeClass(access: AttendanceAccess, className: string): boolean {
  return access.allClasses || access.classNames.includes(className.trim())
}

export function filterClasses(access: AttendanceAccess, classes: string[]): string[] {
  return access.allClasses ? classes : classes.filter(c => canSeeClass(access, c))
}

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export type CourseAccessErrorCode = 'NOT_AUTHENTICATED' | 'NOT_STAFF' | 'NOT_ENROLLED'

export type CourseAccessError = { error: string; code: CourseAccessErrorCode }
export type CourseAccessOk = { user: { id: string }; role: string }
export type CourseAccessResult = CourseAccessOk | CourseAccessError

export function isCourseAccessError(result: CourseAccessResult): result is CourseAccessError {
  return 'error' in result
}

/**
 * Verifies the caller is global instructor/staff/admin. Instructors and staff are
 * globally trusted — any course, not just ones they're personally enrolled in — so
 * no per-course enrollment check is required. `courseId` is accepted for call-site
 * consistency and future scoping but is not currently used to restrict access.
 */
export async function requireCourseInstructorAccess(courseId: string): Promise<CourseAccessResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = profile?.role

  if (role === 'admin' || role === 'instructor' || role === 'staff') return { user, role }

  return { error: 'Only instructors, staff, or admins can do this.', code: 'NOT_STAFF' }
}

export async function getCourseIdForModule(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  moduleId: string
): Promise<string | null> {
  const { data: mod } = await admin.from('modules').select('course_id').eq('id', moduleId).single()
  return mod?.course_id ?? null
}

export async function getCourseIdForModuleDay(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  moduleDayId: string
): Promise<string | null> {
  const { data: day } = await admin.from('module_days').select('module_id').eq('id', moduleDayId).single()
  if (!day) return null
  return getCourseIdForModule(admin, day.module_id)
}

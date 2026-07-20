import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export type CourseAccessErrorCode = 'NOT_AUTHENTICATED' | 'NOT_STAFF' | 'NOT_ENROLLED'

export type CourseAccessError = { error: string; code: CourseAccessErrorCode }
export type CourseAccessOk = { user: { id: string }; role: string }
export type CourseAccessResult = CourseAccessOk | CourseAccessError

export function isCourseAccessError(result: CourseAccessResult): result is CourseAccessError {
  return 'error' in result
}

/**
 * Verifies the caller is global instructor/staff/admin AND, unless they're admin,
 * enrolled as an instructor on this specific course. `code: 'NOT_ENROLLED'` is the
 * only case where the client should offer a "add yourself as instructor" recovery
 * prompt — it means they're already trusted staff, just missing the per-course link.
 */
export async function requireCourseInstructorAccess(courseId: string): Promise<CourseAccessResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = profile?.role

  if (role === 'admin') return { user, role }

  if (role !== 'instructor' && role !== 'staff') {
    return { error: 'Only instructors, staff, or admins can do this.', code: 'NOT_STAFF' }
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('role', 'instructor')
    .maybeSingle()

  if (!enrollment) {
    return { error: 'You are not enrolled as an instructor on this course.', code: 'NOT_ENROLLED' }
  }

  return { user, role }
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

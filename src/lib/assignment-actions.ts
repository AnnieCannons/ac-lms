'use server'

import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getAssignmentCourseId } from '@/lib/course-scope'
import { requireCourseInstructorAccess, isCourseAccessError, getCourseIdForModuleDay, linkedDayInCourse } from '@/lib/course-access'

export async function createAssignment(params: {
  moduleDayId: string
  title?: string
  linkedDayId?: string | null
  skillTags?: string[]
  isBonus?: boolean
}): Promise<{ data?: { id: string }; error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()

  const courseId = await getCourseIdForModuleDay(admin, params.moduleDayId)
  if (!courseId) return { error: 'Could not resolve course' }

  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }
  if (!(await linkedDayInCourse(admin, params.linkedDayId, courseId))) return { error: 'Linked day is not in this course' }

  const { data, error } = await admin
    .from('assignments')
    .insert({
      module_day_id: params.moduleDayId,
      title: params.title ?? 'New Assignment',
      published: false,
      order: 0,
      linked_day_id: params.linkedDayId ?? null,
      skill_tags: params.skillTags ?? [],
      is_bonus: params.isBonus ?? false,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to create assignment' }
  return { data }
}

export async function updateAssignmentDueDate(
  assignmentId: string,
  dueDate: string | null,
  courseId: string,
): Promise<{ error?: string }> {
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error }

  const admin = createServiceSupabaseClient()

  // Verify the assignment actually belongs to this course
  if ((await getAssignmentCourseId(admin, assignmentId)) !== courseId) {
    return { error: 'Assignment not found in this course' }
  }

  const { error } = await admin
    .from('assignments')
    .update({ due_date: dueDate || null })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return {}
}

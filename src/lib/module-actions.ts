'use server'

import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { requireCourseInstructorAccess, isCourseAccessError, getCourseIdForModule } from '@/lib/course-access'

type ModuleData = {
  id: string
  title: string
  order: number
  week_number: number | null
  category: string | null
  skill_tags: string[] | null
}

export async function createModule(params: {
  courseId: string
  title: string
  category: string | null
  order: number
  skillTags?: string[]
}): Promise<{ data?: ModuleData; error?: string; code?: string }> {
  const access = await requireCourseInstructorAccess(params.courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const admin = createServiceSupabaseClient()
  const { data, error } = await admin
    .from('modules')
    .insert({
      course_id: params.courseId,
      title: params.title,
      category: params.category,
      order: params.order,
      skill_tags: params.skillTags ?? [],
    })
    .select('id, title, order, week_number, category, skill_tags')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to create module' }
  return { data: data as ModuleData }
}

export async function createModuleDay(params: {
  moduleId: string
  dayName: string
  order: number
}): Promise<{ data?: { id: string }; error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()

  const courseId = await getCourseIdForModule(admin, params.moduleId)
  if (!courseId) return { error: 'Could not resolve course' }

  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const { data, error } = await admin
    .from('module_days')
    .insert({ module_id: params.moduleId, day_name: params.dayName, order: params.order })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to create day' }
  return { data }
}

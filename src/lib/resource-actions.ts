'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { requireCourseInstructorAccess, isCourseAccessError, getCourseIdForModuleDay } from '@/lib/course-access'

type ResourceData = {
  id: string
  module_day_id: string
  type: string
  title: string
  content: string | null
  order: number
  linked_day_id: string | null
}

export async function createResource(params: {
  moduleDayId: string
  type: 'video' | 'reading' | 'link' | 'file'
  title: string
  content: string | null
  linkedDayId?: string | null
}): Promise<{ data?: ResourceData; error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()

  const courseId = await getCourseIdForModuleDay(admin, params.moduleDayId)
  if (!courseId) return { error: 'Could not resolve course' }

  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const { count } = await admin
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('module_day_id', params.moduleDayId)

  const { data, error } = await admin
    .from('resources')
    .insert({
      module_day_id: params.moduleDayId,
      type: params.type,
      title: params.title,
      content: params.content,
      order: count ?? 0,
      linked_day_id: params.linkedDayId ?? null,
    })
    .select('id, module_day_id, type, title, content, order, linked_day_id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to create resource' }
  return { data: data as ResourceData }
}

export async function toggleResourceStar(resourceId: string, courseId: string, isStarred: boolean): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  if (isStarred) {
    const { error } = await admin.from('resource_stars').delete().eq('user_id', user.id).eq('resource_id', resourceId)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('resource_stars').insert({ user_id: user.id, resource_id: resourceId })
    if (error) return { error: error.message }
  }

  revalidatePath(`/student/courses/${courseId}`)
  revalidatePath(`/student/courses/${courseId}/class-resources`)
  return {}
}

export async function toggleResourceComplete(resourceId: string, courseId: string, isCompleted: boolean): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  if (isCompleted) {
    const { error } = await admin.from('resource_completions').delete().eq('user_id', user.id).eq('resource_id', resourceId)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('resource_completions').insert({ user_id: user.id, resource_id: resourceId })
    if (error) return { error: error.message }
  }

  revalidatePath(`/student/courses/${courseId}`, 'layout')
  revalidatePath(`/student/courses/${courseId}/class-resources`)
  return {}
}

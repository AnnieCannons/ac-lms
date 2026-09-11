'use server'

import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { requireCourseInstructorAccess, isCourseAccessError, getCourseIdForModule, getCourseIdForModuleDay } from '@/lib/course-access'

type WikiData = {
  id: string
  title: string
  content: string
  published: boolean
  order: number
  module_id: string | null
  module_day_id: string | null
}

/** Resolve the course_id for a wiki, or return null if not found */
async function getWikiCourseId(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  wikiId: string
): Promise<string | null> {
  const { data: wiki } = await admin
    .from('wikis')
    .select('module_id, module_day_id')
    .eq('id', wikiId)
    .single()
  if (!wiki) return null

  if (wiki.module_id) {
    const { data: mod } = await admin.from('modules').select('course_id').eq('id', wiki.module_id).single()
    return mod?.course_id ?? null
  }
  if (wiki.module_day_id) {
    const { data: day } = await admin.from('module_days').select('module_id').eq('id', wiki.module_day_id).single()
    if (!day) return null
    const { data: mod } = await admin.from('modules').select('course_id').eq('id', day.module_id).single()
    return mod?.course_id ?? null
  }
  return null
}

export async function createWiki(params: {
  moduleId?: string
  moduleDayId?: string
  title: string
}): Promise<{ data?: WikiData; error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()

  let courseId: string | null = null
  if (params.moduleId) {
    courseId = await getCourseIdForModule(admin, params.moduleId)
  } else if (params.moduleDayId) {
    courseId = await getCourseIdForModuleDay(admin, params.moduleDayId)
  }
  if (!courseId) return { error: 'Could not resolve course' }

  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const insertPayload: {
    title: string
    content: string
    published: boolean
    order: number
    module_id?: string
    module_day_id?: string
  } = {
    title: params.title,
    content: '',
    published: false,
    order: 0,
  }

  if (params.moduleId) {
    insertPayload.module_id = params.moduleId
  } else if (params.moduleDayId) {
    insertPayload.module_day_id = params.moduleDayId
  } else {
    return { error: 'Must provide moduleId or moduleDayId' }
  }

  // Compute order = count of existing wikis for this module/day
  let orderCount = 0
  if (params.moduleId) {
    const { count } = await admin.from('wikis').select('id', { count: 'exact', head: true }).eq('module_id', params.moduleId)
    orderCount = count ?? 0
  } else if (params.moduleDayId) {
    const { count } = await admin.from('wikis').select('id', { count: 'exact', head: true }).eq('module_day_id', params.moduleDayId)
    orderCount = count ?? 0
  }
  insertPayload.order = orderCount

  const { data, error } = await admin
    .from('wikis')
    .insert(insertPayload)
    .select('id, title, content, published, order, module_id, module_day_id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create wiki' }
  return { data: data as WikiData }
}

export async function updateWiki(
  wikiId: string,
  updates: { title?: string; content?: string }
): Promise<{ error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()
  const courseId = await getWikiCourseId(admin, wikiId)
  if (!courseId) return { error: 'Wiki not found' }
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const { error } = await admin.from('wikis').update(updates).eq('id', wikiId)
  if (error) return { error: error.message }
  return {}
}

export async function toggleWikiPublished(
  wikiId: string,
  published: boolean
): Promise<{ error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()
  const courseId = await getWikiCourseId(admin, wikiId)
  if (!courseId) return { error: 'Wiki not found' }
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const { error } = await admin.from('wikis').update({ published }).eq('id', wikiId)
  if (error) return { error: error.message }
  return {}
}

export async function deleteWiki(wikiId: string): Promise<{ error?: string; code?: string }> {
  const admin = createServiceSupabaseClient()
  const courseId = await getWikiCourseId(admin, wikiId)
  if (!courseId) return { error: 'Wiki not found' }
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error, code: access.code }

  const { error } = await admin.from('wikis').delete().eq('id', wikiId)
  if (error) return { error: error.message }
  return {}
}

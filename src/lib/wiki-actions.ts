'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type WikiData = {
  id: string
  title: string
  content: string
  published: boolean
  order: number
  module_id: string | null
  module_day_id: string | null
}

async function getInstructorOrAdminUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null, error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    return { user: null, role: null, error: 'Unauthorized' }
  }
  return { user, role: profile.role, error: null }
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

/** Verify the authenticated user is enrolled as instructor (or is admin) in the wiki's course */
async function verifyWikiAccess(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  userId: string,
  userRole: string,
  wikiId: string
): Promise<boolean> {
  if (userRole === 'admin') return true
  const courseId = await getWikiCourseId(admin, wikiId)
  if (!courseId) return false
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('role', 'instructor')
    .maybeSingle()
  return !!data
}

export async function createWiki(params: {
  moduleId?: string
  moduleDayId?: string
  title: string
}): Promise<{ data?: WikiData; error?: string }> {
  const { user, error: authError } = await getInstructorOrAdminUser()
  if (!user) return { error: authError ?? 'Unauthorized' }

  const admin = createServiceSupabaseClient()

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
): Promise<{ error?: string }> {
  const { user, role, error: authError } = await getInstructorOrAdminUser()
  if (!user || !role) return { error: authError ?? 'Unauthorized' }

  const admin = createServiceSupabaseClient()
  if (!await verifyWikiAccess(admin, user.id, role, wikiId)) return { error: 'Not authorized' }

  const { error } = await admin.from('wikis').update(updates).eq('id', wikiId)
  if (error) return { error: error.message }
  return {}
}

export async function toggleWikiPublished(
  wikiId: string,
  published: boolean
): Promise<{ error?: string }> {
  const { user, role, error: authError } = await getInstructorOrAdminUser()
  if (!user || !role) return { error: authError ?? 'Unauthorized' }

  const admin = createServiceSupabaseClient()
  if (!await verifyWikiAccess(admin, user.id, role, wikiId)) return { error: 'Not authorized' }

  const { error } = await admin.from('wikis').update({ published }).eq('id', wikiId)
  if (error) return { error: error.message }
  return {}
}

export async function deleteWiki(wikiId: string): Promise<{ error?: string }> {
  const { user, role, error: authError } = await getInstructorOrAdminUser()
  if (!user || !role) return { error: authError ?? 'Unauthorized' }

  const admin = createServiceSupabaseClient()
  if (!await verifyWikiAccess(admin, user.id, role, wikiId)) return { error: 'Not authorized' }

  const { error } = await admin.from('wikis').delete().eq('id', wikiId)
  if (error) return { error: error.message }
  return {}
}

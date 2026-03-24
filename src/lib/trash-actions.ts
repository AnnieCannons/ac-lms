'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type ItemType = 'module' | 'day' | 'assignment' | 'resource' | 'quiz'

async function getAuthedAdmin(courseId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
  const admin = createServiceSupabaseClient()
  return { user, admin, courseId }
}

/** Verify an item actually belongs to the given course before mutating it */
async function verifyCourseItem(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  type: ItemType,
  id: string,
  courseId: string
): Promise<boolean> {
  switch (type) {
    case 'module': {
      const { data } = await admin.from('modules').select('course_id').eq('id', id).single()
      return data?.course_id === courseId
    }
    case 'quiz': {
      const { data } = await admin.from('quizzes').select('course_id').eq('id', id).single()
      return data?.course_id === courseId
    }
    case 'day': {
      const { data } = await admin.from('module_days').select('module_id').eq('id', id).single()
      if (!data) return false
      const { data: mod } = await admin.from('modules').select('course_id').eq('id', data.module_id).single()
      return mod?.course_id === courseId
    }
    case 'assignment': {
      const { data } = await admin.from('assignments').select('module_day_id').eq('id', id).single()
      if (!data?.module_day_id) return false
      const { data: day } = await admin.from('module_days').select('module_id').eq('id', data.module_day_id).single()
      if (!day) return false
      const { data: mod } = await admin.from('modules').select('course_id').eq('id', day.module_id).single()
      return mod?.course_id === courseId
    }
    case 'resource': {
      const { data } = await admin.from('resources').select('module_day_id').eq('id', id).single()
      if (!data?.module_day_id) return false
      const { data: day } = await admin.from('module_days').select('module_id').eq('id', data.module_day_id).single()
      if (!day) return false
      const { data: mod } = await admin.from('modules').select('course_id').eq('id', day.module_id).single()
      return mod?.course_id === courseId
    }
  }
}

/** Soft-delete a single assignment */
export async function trashAssignment(assignmentId: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, 'assignment', assignmentId, courseId)) return { error: 'Not authorized' }
  const now = new Date().toISOString()
  const { error } = await admin.from('assignments').update({ deleted_at: now }).eq('id', assignmentId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/** Soft-delete a single resource */
export async function trashResource(resourceId: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, 'resource', resourceId, courseId)) return { error: 'Not authorized' }
  const now = new Date().toISOString()
  const { error } = await admin.from('resources').update({ deleted_at: now }).eq('id', resourceId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/** Soft-delete a single quiz */
export async function trashQuiz(quizId: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, 'quiz', quizId, courseId)) return { error: 'Not authorized' }
  const now = new Date().toISOString()
  const { error } = await admin.from('quizzes').update({ deleted_at: now }).eq('id', quizId).eq('course_id', courseId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/** Soft-delete a day and cascade to its assignments + resources */
export async function trashDay(dayId: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, 'day', dayId, courseId)) return { error: 'Not authorized' }
  const now = new Date().toISOString()

  // Cascade to assignments and resources in this day
  const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
    admin.from('assignments').update({ deleted_at: now }).eq('module_day_id', dayId).is('deleted_at', null),
    admin.from('resources').update({ deleted_at: now }).eq('module_day_id', dayId).is('deleted_at', null),
    admin.from('module_days').update({ deleted_at: now }).eq('id', dayId),
  ])
  if (e1 || e2 || e3) return { error: (e1 ?? e2 ?? e3)!.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/** Soft-delete a module and cascade to all days, assignments, resources within */
export async function trashModule(moduleId: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, 'module', moduleId, courseId)) return { error: 'Not authorized' }
  const now = new Date().toISOString()

  // Get all day IDs in this module
  const { data: days } = await admin.from('module_days').select('id').eq('module_id', moduleId)
  const dayIds = days?.map(d => d.id) ?? []

  const ops = [
    admin.from('modules').update({ deleted_at: now }).eq('id', moduleId).eq('course_id', courseId),
    admin.from('module_days').update({ deleted_at: now }).eq('module_id', moduleId).is('deleted_at', null),
    ...(dayIds.length > 0
      ? [
          admin.from('assignments').update({ deleted_at: now }).in('module_day_id', dayIds).is('deleted_at', null),
          admin.from('resources').update({ deleted_at: now }).in('module_day_id', dayIds).is('deleted_at', null),
        ]
      : []),
  ]
  const results = await Promise.all(ops)
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

// ── Trash page queries ───────────────────────────────────────────────────────

export type TrashedItem = {
  id: string
  type: ItemType
  title: string
  deleted_at: string
  // Restore context
  module_day_id?: string | null
  module_id?: string | null
  day_name?: string | null
  module_title?: string | null
}

export async function getTrashedItems(courseId: string): Promise<{ items?: TrashedItem[]; error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  // Neither resources nor assignments have course_id — traverse via module_days → modules
  const { data: allModules } = await admin.from('modules').select('id').eq('course_id', courseId)
  const allModuleIds = allModules?.map(m => m.id) ?? []
  const { data: allDays } = allModuleIds.length > 0
    ? await admin.from('module_days').select('id').in('module_id', allModuleIds)
    : { data: [] }
  const allDayIds = allDays?.map(d => d.id) ?? []

  // Permanently delete any items that have been in the trash for more than 7 days
  const expiry = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await Promise.all([
    admin.from('quizzes').delete().eq('course_id', courseId).not('deleted_at', 'is', null).lt('deleted_at', expiry),
    admin.from('modules').delete().eq('course_id', courseId).not('deleted_at', 'is', null).lt('deleted_at', expiry),
    ...(allDayIds.length > 0 ? [
      admin.from('assignments').delete().in('module_day_id', allDayIds).not('deleted_at', 'is', null).lt('deleted_at', expiry),
      admin.from('resources').delete().in('module_day_id', allDayIds).not('deleted_at', 'is', null).lt('deleted_at', expiry),
    ] : []),
    ...(allModuleIds.length > 0 ? [
      admin.from('module_days').delete().in('module_id', allModuleIds).not('deleted_at', 'is', null).lt('deleted_at', expiry),
    ] : []),
  ])

  const [modules, days, assignments, resources, quizzes] = await Promise.all([
    admin.from('modules').select('id, title, deleted_at').eq('course_id', courseId).not('deleted_at', 'is', null),
    allModuleIds.length > 0
      ? admin.from('module_days').select('id, day_name, deleted_at, module_id, modules(title)').in('module_id', allModuleIds).not('deleted_at', 'is', null)
      : { data: [] },
    allDayIds.length > 0
      ? admin.from('assignments')
          .select('id, title, deleted_at, module_day_id, module_days!module_day_id(day_name, module_id, modules(title))')
          .in('module_day_id', allDayIds)
          .not('deleted_at', 'is', null)
      : { data: [] },
    allDayIds.length > 0
      ? admin.from('resources')
          .select('id, title, deleted_at, module_day_id, module_days!module_day_id(day_name, module_id, modules(title))')
          .in('module_day_id', allDayIds)
          .not('deleted_at', 'is', null)
      : { data: [] },
    admin.from('quizzes').select('id, title, deleted_at').eq('course_id', courseId).not('deleted_at', 'is', null),
  ])
  function extractDayContext(raw: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = Array.isArray(raw) ? raw[0] : raw
    if (!d) return { day_name: null, module_title: null }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = Array.isArray(d.modules) ? d.modules[0] : d.modules
    return { day_name: d.day_name ?? null, module_title: mod?.title ?? null }
  }

  const items: TrashedItem[] = []

  for (const m of modules.data ?? []) {
    items.push({ id: m.id, type: 'module', title: m.title ?? 'Untitled', deleted_at: m.deleted_at! })
  }
  for (const d of days.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dAny = d as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = Array.isArray(dAny.modules) ? dAny.modules[0] : dAny.modules
    items.push({
      id: dAny.id, type: 'day',
      title: dAny.day_name ?? 'Untitled Day',
      deleted_at: dAny.deleted_at,
      module_id: dAny.module_id,
      module_title: mod?.title ?? null,
    })
  }
  for (const a of assignments.data ?? []) {
    const { day_name, module_title } = extractDayContext(a.module_days)
    items.push({
      id: a.id, type: 'assignment', title: a.title ?? 'Untitled', deleted_at: a.deleted_at!,
      module_day_id: a.module_day_id,
      day_name,
      module_title,
    })
  }
  for (const r of resources.data ?? []) {
    const { day_name, module_title } = extractDayContext(r.module_days)
    items.push({
      id: r.id, type: 'resource', title: r.title ?? 'Untitled', deleted_at: r.deleted_at!,
      module_day_id: r.module_day_id,
      day_name,
      module_title,
    })
  }
  for (const q of quizzes.data ?? []) {
    items.push({ id: q.id, type: 'quiz', title: q.title ?? 'Untitled Quiz', deleted_at: q.deleted_at! })
  }

  // Sort newest-trashed first
  items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())
  return { items }
}

/** Restore a single item (clears deleted_at; quizzes are restored unpublished) */
export async function restoreItem(type: ItemType, id: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, type, id, courseId)) return { error: 'Not authorized' }

  const table = {
    module: 'modules', day: 'module_days', assignment: 'assignments',
    resource: 'resources', quiz: 'quizzes',
  }[type]

  const update: Record<string, unknown> = { deleted_at: null }
  if (type === 'quiz') update.published = false

  const { error } = await admin.from(table).update(update).eq('id', id)
  if (error) return { error: error.message }

  // If restoring a module, also restore its days + their assignments/resources
  if (type === 'module') {
    const { data: days } = await admin.from('module_days').select('id').eq('module_id', id)
    const dayIds = days?.map(d => d.id) ?? []
    await admin.from('module_days').update({ deleted_at: null }).eq('module_id', id)
    if (dayIds.length > 0) {
      await Promise.all([
        admin.from('assignments').update({ deleted_at: null }).in('module_day_id', dayIds),
        admin.from('resources').update({ deleted_at: null }).in('module_day_id', dayIds),
      ])
    }
  }
  // If restoring a day, also restore its assignments/resources
  if (type === 'day') {
    await Promise.all([
      admin.from('assignments').update({ deleted_at: null }).eq('module_day_id', id),
      admin.from('resources').update({ deleted_at: null }).eq('module_day_id', id),
    ])
  }

  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/** Permanently delete a single item from trash */
export async function permanentlyDeleteItem(type: ItemType, id: string, courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth
  if (!await verifyCourseItem(admin, type, id, courseId)) return { error: 'Not authorized' }

  const table = {
    module: 'modules', day: 'module_days', assignment: 'assignments',
    resource: 'resources', quiz: 'quizzes',
  }[type]

  const { error } = await admin.from(table).delete().eq('id', id).not('deleted_at', 'is', null)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/** Permanently delete ALL trashed items for a course */
export async function emptyTrash(courseId: string): Promise<{ error?: string }> {
  const auth = await getAuthedAdmin(courseId)
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  // assignments/resources/module_days have no course_id — traverse via modules → days
  const { data: courseModules } = await admin.from('modules').select('id').eq('course_id', courseId)
  const courseModuleIds = courseModules?.map(m => m.id) ?? []
  const { data: courseDays } = courseModuleIds.length > 0
    ? await admin.from('module_days').select('id').in('module_id', courseModuleIds)
    : { data: [] }
  const courseDayIds = courseDays?.map(d => d.id) ?? []

  const promises = [
    admin.from('quizzes').delete().eq('course_id', courseId).not('deleted_at', 'is', null),
    admin.from('modules').delete().eq('course_id', courseId).not('deleted_at', 'is', null),
    ...(courseDayIds.length > 0
      ? [
          admin.from('assignments').delete().in('module_day_id', courseDayIds).not('deleted_at', 'is', null),
          admin.from('resources').delete().in('module_day_id', courseDayIds).not('deleted_at', 'is', null),
        ]
      : []),
    ...(courseModuleIds.length > 0
      ? [admin.from('module_days').delete().in('module_id', courseModuleIds).not('deleted_at', 'is', null)]
      : []),
  ]
  const results = await Promise.all(promises)
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

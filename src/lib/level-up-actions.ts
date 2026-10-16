'use server'

import { revalidatePath } from 'next/cache'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { requireCourseInstructorAccess, isCourseAccessError } from '@/lib/course-access'
import { isLevelUpPlatform, type LevelUpPlatform } from '@/lib/level-up-platforms'
import { getLevelUpLinks, sortLevelUpLinks, type LevelUpLink } from '@/lib/level-up-links'

type Result<T = object> = ({ error?: undefined } & T) | { error: string }

/**
 * Instructors/staff/admins may edit shared links (course_id null, shown in every course)
 * and any course's extras; a TA may edit only the extras of a course they TA.
 */
async function authorize(courseId: string, shared: boolean): Promise<{ userId: string } | { error: string }> {
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error }
  if (shared && access.role === 'ta') return { error: 'Only instructors and staff can change links shared with every course' }
  return { userId: access.user.id }
}

/** Loads a link and checks it belongs to this course's view (shared, or this course's own) */
async function loadLink(id: string, courseId: string) {
  const { data } = await createServiceSupabaseClient()
    .from('level_up_links')
    .select('id, course_id, platform, order')
    .eq('id', id)
    .maybeSingle()
  if (!data || (data.course_id !== null && data.course_id !== courseId)) return null
  return data as { id: string; course_id: string | null; platform: LevelUpPlatform; order: number }
}

function clean(input: { title?: string; url?: string; description?: string | null }) {
  const title = input.title?.trim()
  const url = input.url?.trim()
  const description = input.description?.trim() || null
  if (title !== undefined && !title) return { error: 'Give the link a title' }
  if (title && title.length > 200) return { error: 'Title is too long (200 characters max)' }
  if (url !== undefined) {
    let parsed: URL
    try { parsed = new URL(url) } catch { return { error: 'Enter a full link starting with https://' } }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { error: 'Enter a full link starting with https://' }
  }
  if (description && description.length > 500) return { error: 'Description is too long (500 characters max)' }
  return { title, url, description }
}

function revalidate(courseId: string) {
  revalidatePath(`/instructor/courses/${courseId}/level-up`)
  revalidatePath(`/student/courses/${courseId}/level-up`)
}

/** Every link this course's editor shows, including hidden ones, plus whether the caller can edit shared links */
export async function listLevelUpLinksForEditor(courseId: string): Promise<Result<{ links: LevelUpLink[]; canEditShared: boolean }>> {
  const access = await requireCourseInstructorAccess(courseId)
  if (isCourseAccessError(access)) return { error: access.error }
  return { links: await getLevelUpLinks(courseId, { includeHidden: true }), canEditShared: access.role !== 'ta' }
}

export async function createLevelUpLink(input: {
  courseId: string
  shared: boolean
  platform: string
  title: string
  url: string
  description?: string | null
}): Promise<Result<{ link: LevelUpLink }>> {
  const auth = await authorize(input.courseId, input.shared)
  if ('error' in auth) return auth
  if (!isLevelUpPlatform(input.platform)) return { error: 'Pick a platform' }
  const fields = clean(input)
  if ('error' in fields) return { error: fields.error as string }

  const admin = createServiceSupabaseClient()
  const courseId = input.shared ? null : input.courseId
  // New links go to the end of their platform's list in the same scope
  const lastQuery = admin
    .from('level_up_links')
    .select('order')
    .eq('platform', input.platform)
  const last = await (courseId === null ? lastQuery.is('course_id', null) : lastQuery.eq('course_id', courseId))
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await admin
    .from('level_up_links')
    .insert({
      course_id: courseId,
      platform: input.platform,
      title: fields.title,
      url: fields.url,
      description: fields.description,
      order: (last.data?.order ?? -1) + 1,
      created_by: auth.userId,
    })
    .select('id, course_id, platform, title, url, description, order, published')
    .single()
  if (error || !data) return { error: error?.message ?? 'Could not save the link' }
  revalidate(input.courseId)
  return { link: data as LevelUpLink }
}

export async function updateLevelUpLink(
  id: string,
  courseId: string,
  patch: { title?: string; url?: string; description?: string | null; published?: boolean },
): Promise<Result> {
  const link = await loadLink(id, courseId)
  if (!link) return { error: 'Link not found' }
  const auth = await authorize(courseId, link.course_id === null)
  if ('error' in auth) return auth
  const fields = clean(patch)
  if ('error' in fields) return { error: fields.error as string }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) update.title = fields.title
  if (patch.url !== undefined) update.url = fields.url
  if (patch.description !== undefined) update.description = fields.description
  if (patch.published !== undefined) update.published = !!patch.published

  const { error } = await createServiceSupabaseClient().from('level_up_links').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidate(courseId)
  return {}
}

export async function deleteLevelUpLink(id: string, courseId: string): Promise<Result> {
  const link = await loadLink(id, courseId)
  if (!link) return { error: 'Link not found' }
  const auth = await authorize(courseId, link.course_id === null)
  if ('error' in auth) return auth
  const { error } = await createServiceSupabaseClient().from('level_up_links').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate(courseId)
  return {}
}

/** Moves a link one place up or down among the same platform's links in the same scope */
export async function moveLevelUpLink(id: string, courseId: string, direction: 'up' | 'down'): Promise<Result> {
  const link = await loadLink(id, courseId)
  if (!link) return { error: 'Link not found' }
  const auth = await authorize(courseId, link.course_id === null)
  if ('error' in auth) return auth

  const admin = createServiceSupabaseClient()
  const siblingQuery = admin
    .from('level_up_links')
    .select('id, course_id, platform, title, url, description, order, published')
    .eq('platform', link.platform)
  const { data: siblings } = await (link.course_id === null ? siblingQuery.is('course_id', null) : siblingQuery.eq('course_id', link.course_id))
  const list = sortLevelUpLinks((siblings ?? []) as LevelUpLink[])
  const i = list.findIndex(l => l.id === id)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= list.length) return {}

  // Renumber the whole list so ties or gaps from older rows can't make a swap a no-op
  ;[list[i], list[j]] = [list[j], list[i]]
  const results = await Promise.all(list.map((l, order) =>
    l.order === order ? null : admin.from('level_up_links').update({ order }).eq('id', l.id)
  ))
  const failed = results.find(r => r?.error)
  if (failed?.error) return { error: failed.error.message }
  revalidate(courseId)
  return {}
}

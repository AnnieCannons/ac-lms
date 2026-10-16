import { createServiceSupabaseClient } from '@/lib/supabase/server'
import type { LevelUpPlatform } from '@/lib/level-up-platforms'

export type LevelUpLink = {
  id: string
  course_id: string | null
  platform: LevelUpPlatform
  title: string
  url: string
  description: string | null
  order: number
  published: boolean
}

const COLUMNS = 'id, course_id, platform, title, url, description, order, published'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Shared links (shown in every course) plus this course's own extras, shared first,
 * each in their saved order. `includeHidden` is for the staff editor only. Callers must
 * have already checked the viewer may see this course.
 */
export async function getLevelUpLinks(courseId: string, { includeHidden = false } = {}): Promise<LevelUpLink[]> {
  // courseId goes into a PostgREST filter string below, so it must be a plain uuid
  if (!UUID_RE.test(courseId)) return []
  let query = createServiceSupabaseClient()
    .from('level_up_links')
    .select(COLUMNS)
    .or(`course_id.is.null,course_id.eq.${courseId}`)
  if (!includeHidden) query = query.eq('published', true)
  const { data } = await query
  return sortLevelUpLinks((data ?? []) as LevelUpLink[])
}

export function sortLevelUpLinks(links: LevelUpLink[]): LevelUpLink[] {
  return [...links].sort((a, b) =>
    Number(a.course_id !== null) - Number(b.course_id !== null) || a.order - b.order || a.title.localeCompare(b.title)
  )
}

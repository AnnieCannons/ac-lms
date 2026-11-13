import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'

// Server-only loader for course completions. Callers must have checked access first.

type Admin = ReturnType<typeof createServiceSupabaseClient>

/**
 * `courseId:userId` keys for every completion in the given courses. The Users, Roster and
 * Students pages only use this for a badge, so a failed read (e.g. the migration not yet
 * applied) shows no badges rather than breaking those pages.
 */
export async function loadCompletionKeys(admin: Admin, courseIds: string[]): Promise<Set<string>> {
  const keys = new Set<string>()
  if (courseIds.length === 0) return keys
  try {
    const rows = await fetchAllRows<{ course_id: string; user_id: string }>((from, to) =>
      admin.from('course_completions').select('course_id, user_id').in('course_id', courseIds).range(from, to) as unknown as PromiseLike<{ data: { course_id: string; user_id: string }[] | null; error: { message: string } | null }>)
    for (const r of rows) keys.add(completionKey(r.course_id, r.user_id))
  } catch (e) {
    console.error('loadCompletionKeys failed:', e instanceof Error ? e.message : e)
  }
  return keys
}

export const completionKey = (courseId: string, userId: string) => `${courseId}:${userId}`

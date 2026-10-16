import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { loadCourses } from '@/lib/cutting-edge-server'
import { isCourseActiveAt } from '@/lib/cutting-edge'

/** Classes offered in the "only specific classes" picker: running now or starting later, plus any already chosen. */
export async function loadPickableCourses(admin: ReturnType<typeof createServiceSupabaseClient>, selected: string[] = []) {
  const now = new Date()
  const courses = await loadCourses(admin)
  return courses
    .filter(c => selected.includes(c.id) || isCourseActiveAt(c, now) || (c.start_date && new Date(c.start_date) > now))
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .map(c => ({ id: c.id, name: c.name }))
}

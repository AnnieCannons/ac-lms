import { createServiceSupabaseClient } from '@/lib/supabase/server'

// Derive an assignment's actual course_id by traversing module_day -> module.
// assignments has no course_id column of its own, so callers must go through this
// rather than trusting a caller-supplied courseId.
export async function getAssignmentCourseId(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  assignmentId: string
): Promise<string | undefined> {
  const { data } = await admin
    .from('assignments')
    .select('module_days!module_day_id(modules(course_id))')
    .eq('id', assignmentId)
    .single()
  const md = Array.isArray(data?.module_days) ? data.module_days[0] : data?.module_days
  const mod = Array.isArray(md?.modules) ? md.modules[0] : md?.modules
  return mod?.course_id
}

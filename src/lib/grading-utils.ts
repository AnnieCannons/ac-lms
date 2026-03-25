import { createServiceSupabaseClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

/**
 * Returns the set of student IDs that the given user is responsible for grading
 * for a specific assignment's module. If week-specific groups exist for that module,
 * uses them; otherwise falls back to course-level groups (module_id IS NULL).
 */
export async function resolveMyStudentIds(
  admin: AdminClient,
  courseId: string,
  moduleId: string | null,
  userId: string
): Promise<Set<string>> {
  if (moduleId) {
    const { data: weekGroups } = await admin
      .from('grading_groups')
      .select('student_id, grader_id')
      .eq('course_id', courseId)
      .eq('module_id', moduleId)

    if (weekGroups && weekGroups.length > 0) {
      return new Set(weekGroups.filter(g => g.grader_id === userId).map(g => g.student_id))
    }
  }

  // Fall back to course-level groups
  const { data: courseGroups } = await admin
    .from('grading_groups')
    .select('student_id')
    .eq('course_id', courseId)
    .is('module_id', null)
    .eq('grader_id', userId)
  return new Set(courseGroups?.map(g => g.student_id) ?? [])
}

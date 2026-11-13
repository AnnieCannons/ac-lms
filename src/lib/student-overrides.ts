import { createServiceSupabaseClient } from '@/lib/supabase/server'

export type StudentOverride = { due_date: string | null; excused: boolean }

/**
 * A student's per-assignment overrides (extended due date and/or excused), keyed by
 * assignment id. Always read with the service client: students have no RLS read access
 * to assignment_overrides, so the user client silently returns nothing and excused or
 * extended work shows as Late / Not Started. Callers must pass a verified studentId.
 */
export async function getStudentOverrides(
  studentId: string,
  assignmentIds: string[],
): Promise<Map<string, StudentOverride>> {
  if (assignmentIds.length === 0) return new Map()
  const { data } = await createServiceSupabaseClient()
    .from('assignment_overrides')
    .select('assignment_id, due_date, excused')
    .eq('student_id', studentId)
    .in('assignment_id', assignmentIds)
  return new Map(
    ((data ?? []) as Array<StudentOverride & { assignment_id: string }>)
      .map(o => [o.assignment_id, { due_date: o.due_date, excused: o.excused }])
  )
}

/** The due date this student actually has for an assignment (their extension, if any). */
export function effectiveDueDate(dueDate: string | null, override: StudentOverride | undefined): string | null {
  return override?.due_date ?? dueDate
}

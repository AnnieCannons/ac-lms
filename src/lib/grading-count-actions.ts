'use server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

export async function getNeedsGradingCount(courseId: string): Promise<number> {
  const admin = createServiceSupabaseClient()

  // Get all published assignments for this course
  const { data: modules } = await admin
    .from('modules')
    .select('id, module_days(id, assignments!module_day_id(id, published))')
    .eq('course_id', courseId)
    .eq('published', true)
    .is('deleted_at', null)

  const assignmentIds = (modules ?? []).flatMap(m =>
    (m.module_days ?? []).flatMap(d =>
      (d.assignments ?? []).filter(a => a.published).map(a => a.id)
    )
  )

  if (assignmentIds.length === 0) return 0

  // Get enrolled students
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('role', 'student')

  const enrolledStudentIds = new Set((enrollments ?? []).map(e => e.user_id))

  // Count submissions with status='submitted' from enrolled students
  const { data: submissions } = await admin
    .from('submissions')
    .select('student_id')
    .in('assignment_id', assignmentIds)
    .eq('status', 'submitted')

  return (submissions ?? []).filter(s => enrolledStudentIds.has(s.student_id)).length
}

'use server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

export async function getNeedsGradingCount(courseId: string): Promise<number> {
  const admin = createServiceSupabaseClient()

  // Get all published assignments for this course (exact same logic as submissions page)
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, week_number, order, module_days(id, day_name, order, assignments!module_day_id(id, title, due_date, published, submission_required))')
    .eq('course_id', courseId)
    .eq('published', true)
    .is('deleted_at', null)
    .order('order', { ascending: true })

  const assignments = (modules ?? []).flatMap(m =>
    (m.module_days ?? []).flatMap(d =>
      (d.assignments ?? []).filter(a => a.published).map(a => ({
        id: a.id,
        title: a.title,
        due_date: a.due_date,
        submission_required: a.submission_required,
        moduleTitle: m.title,
        weekNumber: m.week_number,
      }))
    )
  )

  const assignmentIds = assignments.map(a => a.id)
  if (assignmentIds.length === 0) return 0

  // Get all submissions and enrolled students
  const [{ data: allSubmissions }, { data: enrollments }] = await Promise.all([
    admin
      .from('submissions')
      .select('id, assignment_id, student_id, status, grade, submitted_at')
      .in('assignment_id', assignmentIds),
    admin
      .from('course_enrollments')
      .select('user_id')
      .eq('course_id', courseId)
      .eq('role', 'student'),
  ])

  const enrolledStudentIds = new Set((enrollments ?? []).map(e => e.user_id))

  // Count submissions with status='submitted' per assignment (exact same logic as submissions page)
  const statsMap = new Map<string, number>()

  for (const sub of (allSubmissions ?? []).filter(s => enrolledStudentIds.has(s.student_id))) {
    if (sub.status === 'submitted') {
      statsMap.set(sub.assignment_id, (statsMap.get(sub.assignment_id) ?? 0) + 1)
    }
  }

  return Array.from(statsMap.values()).reduce((sum, count) => sum + count, 0)
}

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function updateAssignmentDueDate(
  assignmentId: string,
  dueDate: string | null,
  courseId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isInstructor = profile?.role === 'instructor'

  if (!isAdmin && !isInstructor) return { error: 'Not authorized' }

  // Instructors must be enrolled in the course
  if (isInstructor) {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('role')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()
    if (!enrollment) return { error: 'Not enrolled in this course' }
  }

  // Verify the assignment actually belongs to this course
  const { data: assignment } = await supabase
    .from('assignments')
    .select('module_days!inner(modules!inner(course_id))')
    .eq('id', assignmentId)
    .maybeSingle()
  const moduleDays = assignment?.module_days as unknown as { modules: { course_id: string } }[] | null
  const assignmentCourseId = moduleDays?.[0]?.modules?.course_id
  if (assignmentCourseId !== courseId) return { error: 'Assignment not found in this course' }

  const { error } = await supabase
    .from('assignments')
    .update({ due_date: dueDate || null })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return {}
}

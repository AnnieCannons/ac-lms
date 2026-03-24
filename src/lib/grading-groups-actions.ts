'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuthedInstructor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
  return { user, supabase, role: profile.role as string }
}

async function verifyInstructorCourseAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  userRole: string,
  courseId: string
): Promise<boolean> {
  if (userRole === 'admin') return true
  const { data } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('role', 'instructor')
    .maybeSingle()
  return !!data
}

export async function setStudentGrader(courseId: string, studentId: string, graderId: string | null) {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  if (!graderId) {
    await supabase
      .from('grading_groups')
      .delete()
      .eq('course_id', courseId)
      .eq('student_id', studentId)
  } else {
    await supabase
      .from('grading_groups')
      .upsert(
        { course_id: courseId, student_id: studentId, grader_id: graderId },
        { onConflict: 'course_id,student_id' }
      )
  }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { success: true }
}

export async function bulkAssignStudentGraders(
  courseId: string,
  assignments: { studentId: string; graderId: string }[]
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()

  // Replace all current assignments for this course
  await admin.from('grading_groups').delete().eq('course_id', courseId)

  if (assignments.length > 0) {
    const { error } = await admin.from('grading_groups').insert(
      assignments.map(a => ({ course_id: courseId, student_id: a.studentId, grader_id: a.graderId }))
    )
    if (error) return { error: error.message }
  }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { success: true }
}

export async function setAssignmentGrader(
  assignmentId: string,
  graderId: string | null,
  courseId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()

  // Verify the assignment belongs to this course via module_days → modules → course_id
  const { data: check } = await admin
    .from('assignments')
    .select('id, module_days!module_day_id(modules!module_id(course_id))')
    .eq('id', assignmentId)
    .single()

  // Supabase returns nested FK as arrays; extract course_id from the join
  const days = check?.module_days as unknown as Array<{ modules: { course_id: string } | { course_id: string }[] }> | null
  const firstDay = Array.isArray(days) ? days[0] : null
  const mod = firstDay?.modules
  const assignmentCourseId = mod ? (Array.isArray(mod) ? mod[0]?.course_id : mod.course_id) : null
  if (assignmentCourseId !== courseId) return { error: 'Assignment not found in this course' }

  const { error } = await admin
    .from('assignments')
    .update({ grader_id: graderId })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return { success: true }
}

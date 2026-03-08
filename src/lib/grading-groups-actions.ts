'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuthedInstructor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
  return { user, supabase }
}

export async function setStudentGrader(courseId: string, studentId: string, graderId: string | null) {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createServerSupabaseClient()

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
  graderId: string | null
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('assignments')
    .update({ grader_id: graderId })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return { success: true }
}

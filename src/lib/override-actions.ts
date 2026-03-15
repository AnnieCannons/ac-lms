'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

async function getAuthedInstructor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
  const admin = createServiceSupabaseClient()
  return { user, admin }
}

/** Verify an assignment belongs to the given course */
async function verifyAssignmentCourse(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  assignmentId: string,
  courseId: string
): Promise<boolean> {
  const { data } = await admin.from('assignments').select('module_day_id').eq('id', assignmentId).single()
  if (!data?.module_day_id) return false
  const { data: day } = await admin.from('module_days').select('module_id').eq('id', data.module_day_id).single()
  if (!day) return false
  const { data: mod } = await admin.from('modules').select('course_id').eq('id', day.module_id).single()
  return mod?.course_id === courseId
}

export async function upsertAssignmentOverride(
  assignmentId: string,
  studentId: string,
  courseId: string,
  dueDate: string | null,
  excused: boolean
): Promise<{ id?: string; error?: string }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  if (!await verifyAssignmentCourse(admin, assignmentId, courseId)) return { error: 'Not authorized' }

  const { data, error } = await admin
    .from('assignment_overrides')
    .upsert(
      { assignment_id: assignmentId, student_id: studentId, due_date: dueDate, excused },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return { id: data.id }
}

export async function removeAssignmentOverride(
  overrideId: string,
  courseId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  // Verify the override's assignment belongs to this course
  const { data: override } = await admin
    .from('assignment_overrides')
    .select('assignment_id')
    .eq('id', overrideId)
    .single()
  if (!override || !await verifyAssignmentCourse(admin, override.assignment_id, courseId)) {
    return { error: 'Not authorized' }
  }

  const { error } = await admin.from('assignment_overrides').delete().eq('id', overrideId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

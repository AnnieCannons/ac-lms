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
  const { error } = await admin.from('assignment_overrides').delete().eq('id', overrideId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

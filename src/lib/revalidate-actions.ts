'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function revalidateAssignmentsPage(courseId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Verify the caller is an instructor/admin or a TA enrolled in this course
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isInstructorOrAdmin = profile?.role === 'instructor' || profile?.role === 'admin'
  if (!isInstructorOrAdmin) {
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('role')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()
    if (enrollment?.role !== 'ta') return
  }

  revalidatePath(`/student/courses/${courseId}/assignments`)
  revalidatePath(`/student/courses/${courseId}`)
}

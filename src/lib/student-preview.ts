import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function isStudentPreview(courseId: string): Promise<boolean> {
  const store = await cookies()
  if (store.get('student-view')?.value !== courseId) return false
  // Instructors, admins, and TAs can use preview mode — students cannot spoof this cookie
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role === 'instructor' || profile?.role === 'admin') return true
  // TAs have users.role = 'student' but course_enrollments.role = 'ta'
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  return enrollment?.role === 'ta'
}

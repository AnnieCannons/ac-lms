import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function isStudentPreview(courseId: string): Promise<boolean> {
  const store = await cookies()
  if (store.get('student-view')?.value !== courseId) return false
  // Only instructors/admins can use preview mode — students cannot spoof this cookie
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'instructor' || profile?.role === 'admin'
}

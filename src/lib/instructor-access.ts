import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Returns the current user and their profile if they have instructor/admin access
 * to the given course, OR if they are a TA enrolled in that course.
 *
 * Redirects to /unauthorized if neither condition is met.
 */
export async function getInstructorOrTaAccess(courseId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    return { user, profile, isTa: false }
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  if (enrollment?.role === 'ta') {
    return { user, profile, isTa: true }
  }

  redirect('/unauthorized')
}

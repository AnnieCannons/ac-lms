import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Returns the current user and their profile if they have instructor/admin access
 * to the given course, OR if they are a TA enrolled in that course.
 *
 * Redirects to /unauthorized if neither condition is met.
 * If studentRedirect is provided and the user is a student enrolled in the course,
 * redirects to that URL instead (e.g. instructor links shared with students).
 */
export async function getInstructorOrTaAccess(courseId: string, studentRedirect?: string) {
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

  if (studentRedirect && (enrollment?.role === 'student' || enrollment?.role === 'observer')) {
    redirect(studentRedirect)
  }

  redirect('/unauthorized')
}

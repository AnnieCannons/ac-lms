import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminPageClient from './AdminPageClient'

const ADMIN_ROLES = ['instructor', 'staff', 'admin']

export default async function FlashcardAdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !ADMIN_ROLES.includes(profile.role ?? '')) redirect('/flashcards')

  const { data: enrolledCourseIds } = await supabase
    .from('course_enrollments')
    .select('course_id')
    .eq('role', 'student')

  const uniqueCourseIds = [...new Set((enrolledCourseIds ?? []).map(e => e.course_id))]

  const { data: courses } = uniqueCourseIds.length > 0
    ? await supabase
        .from('courses')
        .select('id, name')
        .eq('archived', false)
        .in('id', uniqueCourseIds)
        .not('name', 'ilike', '%do not use%')
        .order('name', { ascending: true })
    : { data: [] }

  return <AdminPageClient courses={courses ?? []} />
}

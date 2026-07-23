import { createServerSupabaseClient } from '@/lib/supabase/server'
import StudentActivityClient from './StudentActivityClient'

export default async function StudentActivityPage() {
  const supabase = await createServerSupabaseClient()

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

  return <StudentActivityClient courses={courses ?? []} />
}

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import RosterView from '@/components/ui/RosterView'

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') redirect('/unauthorized')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  const admin = createServiceSupabaseClient()

  // All courses for tabs
  const { data: allCourses } = await admin
    .from('courses')
    .select('id, name')
    .order('created_at', { ascending: false })

  // Students enrolled in current course
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, users(id, name, email)')
    .eq('course_id', id)
    .eq('role', 'student')

  const studentIds = (enrollments ?? []).map(e => e.user_id)

  // Accommodations for those students
  const { data: accommodations } = studentIds.length > 0
    ? await admin
        .from('accommodations')
        .select('user_id, camera_off, notes')
        .in('user_id', studentIds)
    : { data: [] }

  const accommodationMap = Object.fromEntries(
    (accommodations ?? []).map(a => [a.user_id, { cameraOff: a.camera_off, notes: a.notes ?? '' }])
  )

  const students = (enrollments ?? [])
    .map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return {
        userId: e.user_id,
        name: u?.name ?? '',
        email: u?.email ?? '',
        accommodation: accommodationMap[e.user_id] ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Current course first, then rest sorted by name
  const otherCourses = (allCourses ?? []).filter(c => c.id !== id)
  const courses = [course, ...otherCourses]

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <h1 className="text-2xl font-bold text-dark-text mb-8">Roster</h1>
            <RosterView
              courses={courses}
              currentCourseId={id}
              students={students}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

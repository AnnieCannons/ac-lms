import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import AllUsersView from '@/components/ui/AllUsersView'

export default async function AllUsersPage({
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

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    redirect('/unauthorized')
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  const admin = createServiceSupabaseClient()

  // Fetch all students from users table (source of truth — not just enrolled ones)
  const [{ data: allStudentUsers }, { data: courses }, { data: allEnrollments }] = await Promise.all([
    admin.from('users').select('id, name, email').eq('role', 'student').order('name', { ascending: true }),
    admin.from('courses').select('id, name').order('created_at', { ascending: false }),
    admin.from('course_enrollments').select('course_id, user_id').eq('role', 'student'),
  ])

  // Build courses-per-student map from enrollments
  const courseNameMap = Object.fromEntries((courses ?? []).map(c => [c.id, c.name]))
  const enrollmentsByCourseStudent = new Map<string, { id: string; name: string }[]>()
  for (const e of allEnrollments ?? []) {
    if (!enrollmentsByCourseStudent.has(e.user_id)) enrollmentsByCourseStudent.set(e.user_id, [])
    if (courseNameMap[e.course_id]) {
      enrollmentsByCourseStudent.get(e.user_id)!.push({ id: e.course_id, name: courseNameMap[e.course_id] })
    }
  }

  const allStudents = (allStudentUsers ?? []).map(u => ({
    userId: u.id,
    name: u.name ?? '',
    email: u.email ?? '',
    courses: enrollmentsByCourseStudent.get(u.id) ?? [],
  }))

  // All instructors/admins (deduplicated from users table)
  const { data: staffUsers } = await admin
    .from('users')
    .select('id, name, email, role')
    .in('role', ['instructor', 'admin'])
    .order('name', { ascending: true })

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">Users</h1>
              <p className="text-sm text-muted-text mt-1">All courses</p>
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 mb-8 border-b border-border">
              <Link
                href={`/instructor/courses/${id}/users`}
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-text hover:text-dark-text -mb-px transition-colors"
              >
                Current Class
              </Link>
              <Link
                href={`/instructor/courses/${id}/users/all`}
                className="px-4 py-2 text-sm font-medium border-b-2 border-teal-primary text-teal-primary -mb-px"
              >
                All Users
              </Link>
            </div>

            <AllUsersView
              allStudents={allStudents}
              staff={staffUsers ?? []}
              currentUserRole={profile?.role as 'instructor' | 'admin'}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

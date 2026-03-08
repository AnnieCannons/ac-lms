import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import PeopleManager from '@/components/ui/PeopleManager'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'

export default async function InstructorUsersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, isTa } = await getInstructorOrTaAccess(id)

  // TAs cannot manage users
  if (isTa) redirect(`/instructor/courses/${id}`)

  const supabase = await createServerSupabaseClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  const admin = createServiceSupabaseClient()

  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, role, users(id, name, email)')
    .eq('course_id', id)

  const { data: invitations } = await admin
    .from('invitations')
    .select('id, email, role, invited_at, resent_at')
    .eq('course_id', id)
    .eq('status', 'pending')
    .order('invited_at', { ascending: false })

  // Members = non-instructor enrollments (instructors managed separately below)
  const members = (enrollments ?? [])
    .filter(e => e.role !== 'instructor')
    .map((e) => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return {
        userId: e.user_id,
        name: u?.name ?? '',
        email: u?.email ?? '',
        role: e.role as 'student' | 'instructor' | 'admin' | 'observer' | 'ta',
      }
    })

  // Global instructors list — all users with instructor/admin role
  const { data: instructorUsers } = await admin
    .from('users')
    .select('id, name, email')
    .in('role', ['instructor', 'admin'])
    .order('name')

  // All courses for the assignment dropdown
  const { data: allCourses } = await admin
    .from('courses')
    .select('id, name')
    .order('name')

  // Which courses each instructor is assigned to teach
  const instructorIds = instructorUsers?.map(i => i.id) ?? []
  const { data: instructorEnrollments } = instructorIds.length
    ? await admin
        .from('course_enrollments')
        .select('user_id, course_id')
        .in('user_id', instructorIds)
        .eq('role', 'instructor')
    : { data: [] }

  const instructorCourseMap: Record<string, string[]> = {}
  for (const enr of instructorEnrollments ?? []) {
    if (!instructorCourseMap[enr.user_id]) instructorCourseMap[enr.user_id] = []
    instructorCourseMap[enr.user_id].push(enr.course_id)
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">Users</h1>
              <p className="text-sm text-muted-text mt-1">{course.name}</p>
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 mb-8 border-b border-border">
              <Link
                href={`/instructor/courses/${id}/users`}
                className="px-4 py-2 text-sm font-medium border-b-2 border-teal-primary text-teal-primary -mb-px"
              >
                Current Class
              </Link>
              <Link
                href={`/instructor/courses/${id}/users/all`}
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-text hover:text-dark-text -mb-px transition-colors"
              >
                All Users
              </Link>
            </div>

            <PeopleManager
              courseId={id}
              members={members}
              invitations={invitations ?? []}
              currentUserRole={profile?.role as 'instructor' | 'admin'}
              instructors={instructorUsers ?? []}
              allCourses={allCourses ?? []}
              instructorCourseMap={instructorCourseMap}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

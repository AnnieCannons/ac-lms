import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import PeopleManager from '@/components/ui/PeopleManager'

export default async function InstructorUsersPage({
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

  const members = (enrollments ?? []).map((e) => {
    const u = Array.isArray(e.users) ? e.users[0] : e.users
    return {
      userId: e.user_id,
      name: u?.name ?? '',
      email: u?.email ?? '',
      role: e.role as 'student' | 'instructor' | 'admin',
    }
  })

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

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
            />
          </main>
        </div>
      </div>
    </div>
  )
}

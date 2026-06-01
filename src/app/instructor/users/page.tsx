import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import AllUsersView from '@/components/ui/AllUsersView'
import AddPeopleButton from '@/components/ui/AddPeopleButton'
import PendingInvitesTable from '@/components/ui/PendingInvitesTable'

function isCurrentCourse(startDate: string | null | undefined, endDate: string | null | undefined): boolean {
  if (!startDate) return false
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
  const now = Date.now()
  return now >= start && now <= end
}

export default async function GlobalUsersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    redirect('/student/courses')
  }

  const admin = createServiceSupabaseClient()

  const [
    { data: allCourses },
    { data: allStudentUsers },
    { data: allEnrollments },
    { data: staffUsers },
    { data: pendingInvites },
  ] = await Promise.all([
    admin.from('courses').select('id, name, start_date, end_date, is_template, archived').order('start_date', { ascending: false }),
    admin.from('users').select('id, name, email').eq('role', 'student').order('name'),
    admin.from('course_enrollments').select('course_id, user_id').eq('role', 'student'),
    admin.from('users').select('id, name, email, role').in('role', ['instructor', 'staff', 'admin']).order('name'),
    admin.from('invitations').select('id, email, role, invited_at, resent_at, course_id, courses(name)').eq('status', 'pending').order('invited_at', { ascending: false }),
  ])

  const activeCourses = (allCourses ?? []).filter(c => !c.is_template && !c.archived && isCurrentCourse(c.start_date, c.end_date))
  const allCoursesForPicker = (allCourses ?? []).filter(c => !c.is_template && !c.archived)

  // Build enrollment maps
  const enrolledUserIdsByCourse = new Map<string, Set<string>>()
  const courseIdsByStudent = new Map<string, string[]>()
  for (const e of allEnrollments ?? []) {
    if (!enrolledUserIdsByCourse.has(e.course_id)) enrolledUserIdsByCourse.set(e.course_id, new Set())
    enrolledUserIdsByCourse.get(e.course_id)!.add(e.user_id)
    if (!courseIdsByStudent.has(e.user_id)) courseIdsByStudent.set(e.user_id, [])
    courseIdsByStudent.get(e.user_id)!.push(e.course_id)
  }

  const studentMap = Object.fromEntries((allStudentUsers ?? []).map(u => [u.id, u]))
  const activeCourseIds = new Set(activeCourses.map(c => c.id))

  // Students grouped by active course
  const courseGroups = activeCourses.map(course => {
    const enrolledIds = enrolledUserIdsByCourse.get(course.id) ?? new Set()
    const students = [...enrolledIds]
      .map(id => studentMap[id])
      .filter(Boolean)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    return { course, students }
  }).filter(g => g.students.length > 0)

  // Students not enrolled in any active course
  const unenrolledStudents = (allStudentUsers ?? []).filter(u => {
    const myCourses = courseIdsByStudent.get(u.id) ?? []
    return !myCourses.some(cid => activeCourseIds.has(cid))
  })

  const totalStudents = (allStudentUsers ?? []).length

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Users</h1>
            <p className="text-sm text-muted-text mt-1">{totalStudents} student{totalStudents !== 1 ? 's' : ''} · {(staffUsers ?? []).length} staff</p>
          </div>
          <AddPeopleButton
            courseId={allCoursesForPicker[0]?.id ?? ''}
            currentUserRole={profile?.role as 'instructor' | 'staff' | 'admin'}
            allCourses={allCoursesForPicker}
          />
        </div>

        {/* Staff & Admins */}
        <AllUsersView
          allStudents={[]}
          staff={staffUsers ?? []}
          currentUserRole={profile?.role as 'instructor' | 'staff' | 'admin'}
          hideStudents
        />

        {/* Pending Invites */}
        {(pendingInvites ?? []).length > 0 && (
          <div className="mt-10">
            <PendingInvitesTable
              invites={(pendingInvites ?? []).map(i => ({
                id: i.id,
                email: i.email,
                role: i.role,
                invited_at: i.invited_at,
                resent_at: i.resent_at,
                courseName: Array.isArray(i.courses)
                  ? (i.courses[0] as { name: string } | undefined)?.name ?? null
                  : (i.courses as { name: string } | null)?.name ?? null,
              }))}
              currentUserRole={profile?.role as 'instructor' | 'staff' | 'admin'}
            />
          </div>
        )}

        {/* Students by course */}
        <div className="mt-10 space-y-10">
          {courseGroups.map(({ course, students }) => (
            <section key={course.id}>
              <h2 className="text-base font-semibold text-dark-text mb-4">
                {course.name} <span className="text-muted-text font-normal">({students.length})</span>
              </h2>
              <StudentTable students={students} />
            </section>
          ))}

          {unenrolledStudents.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-dark-text mb-4">
                Not enrolled in a current course <span className="text-muted-text font-normal">({unenrolledStudents.length})</span>
              </h2>
              <StudentTable students={unenrolledStudents} />
            </section>
          )}

          {totalStudents === 0 && (
            <p className="text-sm text-muted-text">No students yet.</p>
          )}

          {/* Past Students — coming soon */}
          <section>
            <h2 className="text-base font-semibold text-dark-text mb-4">Past Students</h2>
            <p className="text-sm text-muted-text">Coming soon.</p>
          </section>
        </div>
      </main>
    </div>
  )
}

function StudentTable({ students }: { students: { id: string; name: string | null; email: string }[] }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border">
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {students.map(s => (
            <tr key={s.id} className="bg-background">
              <td className="px-4 py-3 text-dark-text">{s.name || '—'}</td>
              <td className="px-4 py-3 text-muted-text">{s.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

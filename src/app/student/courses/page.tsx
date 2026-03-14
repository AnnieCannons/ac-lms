import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'

export default async function StudentCoursesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  // Instructors/admins don't belong here
  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    redirect('/instructor/courses')
  }

  // Fetch all enrollments (student + TA)
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('course_id, role')
    .eq('user_id', user.id)
    .in('role', ['student', 'observer', 'ta'])

  const courseIds = enrollments?.map(e => e.course_id) ?? []
  const enrollmentRoleMap = Object.fromEntries((enrollments ?? []).map(e => [e.course_id, e.role]))

  const { data: courses } = courseIds.length
    ? await supabase
        .from('courses')
        .select('id, name, code, start_date, end_date')
        .in('id', courseIds)
        .order('name', { ascending: true })
    : { data: [] }

  function isCurrent(startDate: string | null | undefined, endDate?: string | null): boolean {
    if (!startDate) return false
    const start = new Date(startDate).getTime()
    const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
    return Date.now() >= start && Date.now() <= end
  }

  const sortedCourses = [...(courses ?? [])].sort((a, b) => {
    const aC = isCurrent(a.start_date, a.end_date) ? 0 : 1
    const bC = isCurrent(b.start_date, b.end_date) ? 0 : 1
    if (aC !== bC) return aC - bC
    return a.name.localeCompare(b.name)
  })

  const totalCount = sortedCourses.length

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-6 md:px-8 md:py-12 focus:outline-none">
        <h2 className="text-xl sm:text-2xl font-bold text-dark-text mb-2">My Courses</h2>
        <p className="text-muted-text text-sm mb-8">
          {totalCount} course{totalCount !== 1 ? 's' : ''} enrolled
        </p>

        {sortedCourses.length > 0 ? (
          <div className="flex flex-col gap-4">
            {sortedCourses.map(course => {
              const enrollmentRole = enrollmentRoleMap[course.id]
              const isTa = enrollmentRole === 'ta'
              const current = isCurrent(course.start_date, course.end_date)
              return (
                <div
                  key={course.id}
                  className="bg-surface rounded-2xl border border-border p-4 sm:p-6 hover:border-teal-primary transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-dark-text truncate">{course.name}</h3>
                        {current && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-current shrink-0">Current</span>
                        )}
                        {isTa && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-ta shrink-0">TA</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-text">{course.code}</p>
                      {course.start_date && (
                        <p className="text-xs text-muted-text mt-1">
                          {new Date(course.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {course.end_date && ` – ${new Date(course.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isTa && (
                        <Link
                          href={`/instructor/courses/${course.id}`}
                          className="text-blue-700 text-sm font-medium hover:underline"
                        >
                          Instructor View →
                        </Link>
                      )}
                      <Link
                        href={`/student/courses/${course.id}`}
                        className="text-teal-primary text-sm font-medium hover:underline"
                      >
                        {isTa ? 'Student View →' : 'View →'}
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">You are not enrolled in any courses yet.</p>
            <p className="text-muted-text text-sm mt-2">Contact your instructor to get enrolled.</p>
          </div>
        )}
      </main>
    </div>
  )
}

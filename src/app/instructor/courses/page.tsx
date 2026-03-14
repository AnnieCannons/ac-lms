import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import DeleteCourseButton from '@/components/ui/DeleteCourseButton'
import DuplicateCourseButton from '@/components/ui/DuplicateCourseButton'
import EditCourseDatesButton from '@/components/ui/EditCourseDatesButton'

export default async function CoursesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isInstructorOrAdmin = profile?.role === 'instructor' || profile?.role === 'admin'

  // If not instructor/admin, check if they're a TA or student in any course
  if (!isInstructorOrAdmin) {
    const admin = createServiceSupabaseClient()

    // Fetch all enrollments for this user (TA or student)
    const { data: enrollments } = await admin
      .from('course_enrollments')
      .select('course_id, role')
      .eq('user_id', user.id)
      .in('role', ['ta', 'student'])

    const taEnrollments = (enrollments ?? []).filter(e => e.role === 'ta')

    if (taEnrollments.length === 0) {
      redirect('/unauthorized')
    }

    // Fetch all relevant course details in one query
    const allCourseIds = [...new Set((enrollments ?? []).map(e => e.course_id))]
    const { data: coursesData } = await admin
      .from('courses')
      .select('id, name, start_date, end_date')
      .in('id', allCourseIds)

    const courseMap = Object.fromEntries((coursesData ?? []).map(c => [c.id, c]))

    // Build list: TA courses first, then student courses, with role labels
    const taCourseIds = new Set(taEnrollments.map(e => e.course_id))
    const studentCourseIds = new Set(
      (enrollments ?? []).filter(e => e.role === 'student').map(e => e.course_id)
    )

    const rows = [
      ...[...taCourseIds].map(id => ({ ...courseMap[id], enrollmentRole: 'ta' as const })),
      ...[...studentCourseIds].map(id => ({ ...courseMap[id], enrollmentRole: 'student' as const })),
    ].filter(r => r.id)

    const isCurrentCourse = (startDate: string | null | undefined, endDate?: string | null) => {
      if (!startDate) return false
      const start = new Date(startDate).getTime()
      const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
      return Date.now() >= start && Date.now() <= end
    }

    const sortedRows = [...rows].sort((a, b) => {
      const aC = isCurrentCourse((a as typeof a & { start_date?: string; end_date?: string }).start_date, (a as typeof a & { end_date?: string }).end_date) ? 0 : 1
      const bC = isCurrentCourse((b as typeof b & { start_date?: string; end_date?: string }).start_date, (b as typeof b & { end_date?: string }).end_date) ? 0 : 1
      return aC - bC
    })

    return (
      <div className="min-h-screen bg-background">
        <InstructorTopNav name={profile?.name} role={profile?.role} />

        <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-8 sm:py-12 focus:outline-none">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-dark-text">My Courses</h2>
          </div>

          <div className="flex flex-col gap-4">
            {sortedRows.map(course => {
              const current = isCurrentCourse((course as typeof course & { start_date?: string; end_date?: string }).start_date, (course as typeof course & { end_date?: string }).end_date)
              return (
              <div
                key={course.id}
                className="bg-surface rounded-2xl border border-border p-4 sm:p-6 hover:border-teal-primary transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={course.enrollmentRole === 'ta' ? `/instructor/courses/${course.id}` : `/student/courses/${course.id}`} className="font-semibold text-dark-text truncate">
                    {course.name}
                  </Link>
                  {current && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-current shrink-0">Current</span>
                  )}
                  {course.enrollmentRole === 'ta' ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-ta shrink-0">TA</span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-light text-teal-primary shrink-0">Student</span>
                  )}
                </div>
                <Link
                  href={course.enrollmentRole === 'ta' ? `/instructor/courses/${course.id}` : `/student/courses/${course.id}`}
                  className="text-teal-primary text-sm font-medium shrink-0"
                >
                  {course.enrollmentRole === 'ta' ? 'Instructor View →' : 'Student View →'}
                </Link>
              </div>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  const { data: rawCourses } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })

  const isCurrentCourse = (startDate: string | null | undefined, isTemplate: boolean, endDate?: string | null) => {
    if (!startDate || isTemplate) return false
    const start = new Date(startDate).getTime()
    const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
    return Date.now() >= start && Date.now() <= end
  }

  const courses = [...(rawCourses ?? [])].sort((a, b) => {
    const aC = isCurrentCourse(a.start_date, a.is_template, a.end_date) ? 0 : 1
    const bC = isCurrentCourse(b.start_date, b.is_template, b.end_date) ? 0 : 1
    return aC - bC
  })

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-8 sm:py-12 focus:outline-none">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-dark-text">Courses</h2>
          <Link
            href="/instructor/courses/new"
            className="bg-teal-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + New Course
          </Link>
        </div>

        {courses.length > 0 ? (
          <div className="flex flex-col gap-4">
            {courses.map(course => (
              <div
                key={course.id}
                className="bg-surface rounded-2xl border border-border p-4 sm:p-6 hover:border-teal-primary transition-colors flex flex-col gap-3"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/instructor/courses/${course.id}`} className="font-semibold text-dark-text">
                    {course.name}
                  </Link>
                  {isCurrentCourse(course.start_date, course.is_template, course.end_date) && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-current shrink-0">Current</span>
                  )}
                  {course.start_date && (
                    <span className="text-xs text-muted-text shrink-0">
                      {new Date(course.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <Link href={`/instructor/courses/${course.id}`} className="text-teal-primary text-sm font-medium">
                    Manage →
                  </Link>
                  <EditCourseDatesButton
                    courseId={course.id}
                    initialStartDate={course.start_date ?? null}
                    initialEndDate={course.end_date ?? null}
                  />
                  <DuplicateCourseButton
                    courseId={course.id}
                    courseName={course.name}
                    courseCode={course.code}
                    courseStartDate={course.start_date ?? null}
                  />
                  <DeleteCourseButton courseId={course.id} courseName={course.name} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text mb-4">No courses yet.</p>
            <Link
              href="/instructor/courses/new"
              className="bg-teal-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90"
            >
              Create your first course
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

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

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('course_id')
    .eq('user_id', user.id)
    .eq('role', 'student')

  const courseIds = enrollments?.map(e => e.course_id) ?? []

  const { data: courses } = courseIds.length
    ? await supabase
        .from('courses')
        .select('id, name, code, start_date, end_date')
        .in('id', courseIds)
        .order('name', { ascending: true })
    : { data: [] }

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />

      <main className="max-w-4xl mx-auto px-8 py-12">
        <h2 className="text-2xl font-bold text-dark-text mb-2">My Courses</h2>
        <p className="text-muted-text text-sm mb-8">
          {courses?.length ?? 0} course{(courses?.length ?? 0) !== 1 ? 's' : ''} enrolled
        </p>

        {courses && courses.length > 0 ? (
          <div className="flex flex-col gap-4">
            {courses.map(course => (
              <Link
                key={course.id}
                href={`/student/courses/${course.id}`}
                className="bg-surface rounded-2xl border border-border p-6 hover:border-teal-primary transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-dark-text">{course.name}</h3>
                    <p className="text-sm text-muted-text mt-1">{course.code}</p>
                    {course.start_date && (
                      <p className="text-xs text-muted-text mt-1">
                        {new Date(course.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {course.end_date && ` – ${new Date(course.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </p>
                    )}
                  </div>
                  <span className="text-teal-primary text-sm font-medium">View →</span>
                </div>
              </Link>
            ))}
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

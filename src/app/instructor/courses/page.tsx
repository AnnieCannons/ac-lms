import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import DeleteCourseButton from '@/components/ui/DeleteCourseButton'
import DuplicateCourseButton from '@/components/ui/DuplicateCourseButton'

export default async function CoursesPage() {
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

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-12 focus:outline-none">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-dark-text">Courses</h2>
          <Link
            href="/instructor/courses/new"
            className="bg-teal-primary text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + New Course
          </Link>
        </div>

        {courses && courses.length > 0 ? (
          <div className="flex flex-col gap-4">
            {courses.map(course => (
              <div
                key={course.id}
                className="bg-surface rounded-2xl border border-border p-6 hover:border-teal-primary transition-colors flex items-center justify-between gap-4"
              >
                <Link href={`/instructor/courses/${course.id}`} className="flex-1 min-w-0">
                  <h3 className="font-semibold text-dark-text">{course.name}</h3>
                  <p className="text-sm text-muted-text mt-1">{course.code}</p>
                </Link>
                <div className="flex items-center gap-4 shrink-0">
                  <Link href={`/instructor/courses/${course.id}`} className="text-teal-primary text-sm font-medium">
                    Manage →
                  </Link>
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
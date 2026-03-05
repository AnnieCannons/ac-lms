import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import CourseOutlineAccordion from '@/components/ui/CourseOutlineAccordion'
import PageRefresher from '@/components/ui/PageRefresher'

export const dynamic = 'force-dynamic'

function getCurrentWeek(startDate: string | null): number | null {
  if (!startDate) return null
  const start = new Date(startDate)
  const today = new Date()
  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return null // course hasn't started yet
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function StudentCourseDetailPage({
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

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    redirect(`/instructor/courses/${id}`)
  }

  // Verify learner is enrolled in this course
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .eq('role', 'student')
    .maybeSingle()

  if (!enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: rawModules } = await supabase
    .from('modules')
    .select('*, module_days(id, day_name, order, assignments(id, title, due_date, published), resources(id, type, title, content, description, order))')
    .eq('course_id', id)
    .order('order', { ascending: true })

  const modules = (rawModules ?? []).filter(m =>
    !m.title?.includes('DO NOT PUBLISH') && m.category === 'syllabus' && m.published === true
  )

  const { data: submissions } = await supabase
    .from('submissions')
    .select('assignment_id, status, grade')
    .eq('student_id', user.id)

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, { status: s.status, grade: s.grade ?? null }])
  )

  const currentWeek = getCurrentWeek(course.start_date)
  const todayName = DAY_NAMES[new Date().getDay()]

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile?.name} · <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <div className="flex">
        {/* Left sidebar */}
        <aside className="w-56 shrink-0 border-r border-border min-h-[calc(100vh-65px)] py-8 px-3">
          <StudentCourseNav courseId={id} courseName={course.name} />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← My Courses
              </Link>
            </div>

            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-dark-text mb-1">Syllabus</h1>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-muted-text text-sm">{course.code}</p>
                  {course.start_date && (
                    <p className="text-muted-text text-sm">
                      {new Date(course.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {course.end_date && ` – ${new Date(course.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  )}
                  {currentWeek && (
                    <span className="bg-teal-light text-teal-primary text-xs font-semibold px-3 py-1 rounded-full">
                      Week {currentWeek} this week
                    </span>
                  )}
                </div>
              </div>
            </div>

            <PageRefresher />
            {modules.length > 0 ? (
              <CourseOutlineAccordion
                modules={modules as Parameters<typeof CourseOutlineAccordion>[0]['modules']}
                courseId={id}
                currentWeek={currentWeek}
                todayName={todayName}
                submissionMap={submissionMap}
              />
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No modules available yet.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

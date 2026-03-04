import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

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

  const { data: modules } = await supabase
    .from('modules')
    .select('*, module_days(id, day_name, order, assignments(id, title, due_date, published))')
    .eq('course_id', id)
    .order('order', { ascending: true })

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

      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
            ← My Courses
          </Link>
          <span className="text-border">/</span>
          <h2 className="text-2xl font-bold text-dark-text">{course.name}</h2>
        </div>

        <div className="flex items-center justify-between gap-4 mb-8">
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
          <Link
            href={`/student/courses/${id}/work`}
            className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity shrink-0"
          >
            My Work →
          </Link>
        </div>

        {modules && modules.length > 0 ? (
          <div className="flex flex-col gap-6">
            {modules.map(module => {
              const isCurrentWeek = currentWeek !== null && module.week_number === currentWeek
              const sortedDays = [...(module.module_days ?? [])].sort((a, b) => a.order - b.order)

              return (
                <div
                  key={module.id}
                  className={`bg-surface rounded-2xl border p-6 transition-colors ${
                    isCurrentWeek ? 'border-teal-primary shadow-sm' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="font-semibold text-dark-text">{module.title}</h3>
                    {module.week_number && (
                      <span className="text-xs text-muted-text">Week {module.week_number}</span>
                    )}
                    {isCurrentWeek && (
                      <span className="bg-teal-light text-teal-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                        Current Week
                      </span>
                    )}
                  </div>

                  {sortedDays.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {sortedDays.map(day => {
                        const isToday = isCurrentWeek && day.day_name === todayName
                        const assignmentCount = day.assignments?.filter((a: { published: boolean }) => a.published).length ?? 0

                        return (
                          <div
                            key={day.id}
                            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                              isToday
                                ? 'bg-teal-light border border-teal-primary'
                                : 'bg-background border border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-medium ${isToday ? 'text-teal-primary' : 'text-dark-text'}`}>
                                {day.day_name}
                              </span>
                              {isToday && (
                                <span className="text-xs text-teal-primary font-semibold">Today</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              {assignmentCount > 0 && (
                                <span className="text-xs text-muted-text">
                                  {assignmentCount} assignment{assignmentCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              <Link
                                href={`/student/courses/${id}/days/${day.id}`}
                                className="text-xs text-teal-primary font-medium hover:underline"
                              >
                                View →
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-text text-sm">No days scheduled yet.</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No modules available yet.</p>
          </div>
        )}
      </main>
    </div>
  )
}

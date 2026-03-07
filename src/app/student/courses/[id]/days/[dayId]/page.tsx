import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'
import DayResourceList from '@/components/ui/DayResourceList'
import NavDrawer from '@/components/ui/NavDrawer'

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export default async function StudentDayDetailPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>
}) {
  const { id, dayId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const preview = await isStudentPreview(id)

  if (!preview && (profile?.role === 'instructor' || profile?.role === 'admin')) {
    redirect(`/instructor/courses/${id}`)
  }

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .eq('role', 'student')
    .maybeSingle()

  if (!preview && !enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: day } = await supabase
    .from('module_days')
    .select('id, day_name, module_id, modules(id, title, week_number)')
    .eq('id', dayId)
    .single()

  if (!day) redirect(`/student/courses/${id}`)

  const [{ data: resources }, { data: stars }, { data: completions }] = await Promise.all([
    supabase.from('resources').select('id, type, title, content, description, order').eq('module_day_id', dayId).order('order', { ascending: true }),
    supabase.from('resource_stars').select('resource_id').eq('user_id', user.id),
    supabase.from('resource_completions').select('resource_id').eq('user_id', user.id),
  ])

  const starredIds = (stars ?? []).map(s => s.resource_id)
  const completedIds = (completions ?? []).map(c => c.resource_id)

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, description, due_date')
    .eq('module_day_id', dayId)
    .eq('published', true)
    .order('due_date', { ascending: true })

  const module = Array.isArray(day.modules) ? day.modules[0] : day.modules

  let quizzes: Array<{ id: string; title: string; questions: unknown[]; max_attempts: number | null; due_at: string | null }> = []
  let quizSubmissions: Array<{ quiz_id: string; score_percent: number | null; attempt_count: number | null }> = []

  if (module?.title && day.day_name) {
    const { data: quizData } = await supabase
      .from('quizzes')
      .select('id, title, questions, max_attempts, due_at')
      .eq('course_id', id)
      .eq('module_title', module.title)
      .eq('day_title', day.day_name)
      .eq('published', true)
    quizzes = (quizData ?? []) as typeof quizzes

    if (quizzes.length > 0) {
      const quizIds = quizzes.map(q => q.id)
      const { data: subData } = await supabase
        .from('quiz_submissions')
        .select('quiz_id, score_percent, attempt_count')
        .eq('student_id', user.id)
        .in('quiz_id', quizIds)
      quizSubmissions = (subData ?? []) as typeof quizSubmissions
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}
      <NavDrawer courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false}>
      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-12 focus:outline-none">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/student/courses" className="hover:text-teal-primary">My Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/student/courses/${id}`} className="hover:text-teal-primary">{course.name}</Link>
          <span className="text-border">/</span>
          {module && <span className="text-muted-text">{module.title}</span>}
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">{day.day_name}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-dark-text mb-1">{day.day_name}</h2>
        {module && (
          <p className="text-muted-text text-sm mb-8">
            {module.title}{module.week_number ? ` · Week ${module.week_number}` : ''}
          </p>
        )}

        <div className="flex flex-col gap-8">
          {/* Resources */}
          <section>
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Resources</h3>
            {resources && resources.length > 0 ? (
              <DayResourceList
                resources={resources}
                courseId={id}
                initialStarredIds={starredIds}
                initialCompletedIds={completedIds}
              />
            ) : (
              <p className="text-muted-text text-sm">No resources for this day.</p>
            )}
          </section>

          {/* Assignments */}
          <section>
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Assignments</h3>
            {assignments && assignments.length > 0 ? (
              <div className="flex flex-col gap-3">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="bg-surface rounded-xl border border-border px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark-text">{assignment.title}</p>
                        {assignment.description && (
                          <p className="text-sm text-muted-text mt-1 line-clamp-2">{stripHtml(assignment.description)}</p>
                        )}
                        {assignment.due_date && (
                          <p className="text-xs text-muted-text mt-2">
                            Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/student/courses/${id}/assignments/${assignment.id}`}
                        className="text-xs text-teal-primary font-medium hover:underline shrink-0"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-text text-sm">No assignments for this day.</p>
            )}
          </section>

          {/* Quizzes */}
          {quizzes.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Quizzes</h3>
              <div className="flex flex-col gap-3">
                {quizzes.map(quiz => {
                  const sub = quizSubmissions.find(s => s.quiz_id === quiz.id)
                  const displayTitle = quiz.title.startsWith('Quiz: ') ? quiz.title.slice(6) : quiz.title
                  const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0
                  const attemptsUsed = sub?.attempt_count ?? 0
                  const maxAttempts = quiz.max_attempts
                  const outOfAttempts = maxAttempts !== null && attemptsUsed >= maxAttempts
                  return (
                    <div key={quiz.id} className="bg-surface rounded-xl border border-border px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-dark-text">{displayTitle}</p>
                          <p className="text-xs text-muted-text mt-1">
                            {questionCount} question{questionCount !== 1 ? 's' : ''}
                            {sub && sub.score_percent != null && (
                              <> · Score: {Math.round(sub.score_percent)}%</>
                            )}
                            {maxAttempts !== null && (
                              <> · {attemptsUsed}/{maxAttempts} attempts</>
                            )}
                          </p>
                        </div>
                        {!outOfAttempts ? (
                          <Link
                            href={`/student/courses/${id}/quizzes/${quiz.id}`}
                            className="text-xs text-teal-primary font-medium hover:underline shrink-0"
                          >
                            {sub ? 'Retake →' : 'Take →'}
                          </Link>
                        ) : (
                          <Link
                            href={`/student/courses/${id}/quizzes/${quiz.id}`}
                            className="text-xs text-muted-text hover:underline shrink-0"
                          >
                            View results →
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>
      </NavDrawer>
    </div>
  )
}

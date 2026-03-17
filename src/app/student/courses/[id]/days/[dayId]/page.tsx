import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'
import DayResourceList from '@/components/ui/DayResourceList'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import WikiView from '@/components/ui/WikiView'

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
    .select('id, role')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .in('role', ['student', 'observer', 'ta'])
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

  const admin2 = createServiceSupabaseClient()
  const [{ data: resources }, { data: stars }, { data: completions }, { data: dayWikis }] = await Promise.all([
    supabase.from('resources').select('id, type, title, content, description, order, linked_day_id').or(`module_day_id.eq.${dayId},linked_day_id.eq.${dayId}`).is('deleted_at', null).order('order', { ascending: true }),
    supabase.from('resource_stars').select('resource_id').eq('user_id', user.id),
    supabase.from('resource_completions').select('resource_id').eq('user_id', user.id),
    admin2.from('wikis').select('id, title, content').eq('module_day_id', dayId).eq('published', true).order('order', { ascending: true }),
  ])

  const starredIds = (stars ?? []).map(s => s.resource_id)
  const completedIds = (completions ?? []).map(c => c.resource_id)

  type DayAssignment = { id: string; title: string; description: string | null; due_date: string | null; skill_tags?: string[] | null; is_bonus?: boolean; careerDev?: boolean }

  const [{ data: nativeAssignments }, { data: crossAssignments }] = await Promise.all([
    supabase.from('assignments').select('id, title, description, due_date, skill_tags, is_bonus').eq('module_day_id', dayId).eq('published', true).is('deleted_at', null).order('due_date', { ascending: true }),
    supabase.from('assignments').select('id, title, description, due_date, skill_tags, is_bonus').eq('linked_day_id', dayId).eq('published', true).is('deleted_at', null).order('due_date', { ascending: true }),
  ])

  const assignments: DayAssignment[] = [
    ...((nativeAssignments ?? []) as DayAssignment[]),
    ...((crossAssignments ?? []).map(a => ({ ...a, careerDev: true })) as DayAssignment[]),
  ]

  const module = Array.isArray(day.modules) ? day.modules[0] : day.modules

  let quizzes: Array<{ id: string; title: string; questions: unknown[]; max_attempts: number | null; due_at: string | null; careerDev?: boolean }> = []
  let quizSubmissions: Array<{ quiz_id: string; score_percent: number | null; attempt_count: number | null }> = []

  const admin = createServiceSupabaseClient()

  const assignmentIds = assignments.map(a => a.id)
  const { data: dayOverrideRows } = assignmentIds.length > 0
    ? await admin
        .from('assignment_overrides')
        .select('assignment_id, due_date, excused')
        .eq('student_id', user.id)
        .in('assignment_id', assignmentIds)
    : { data: [] }
  const dayOverrideMap = new Map((dayOverrideRows ?? []).map((o: { assignment_id: string; due_date: string | null; excused: boolean }) => [o.assignment_id, o]))
  const weekMatch = module?.title?.match(/^Week\s+(\d+)/i)
  const weekNumber = weekMatch ? parseInt(weekMatch[1], 10) : null

  const [{ data: dayQuizData }, { data: crossQuizData }] = await Promise.all([
    day.day_name
      ? admin.from('quizzes').select('id, title, questions, max_attempts, due_at, module_title').eq('course_id', id).eq('day_title', day.day_name).eq('published', true).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    admin.from('quizzes').select('id, title, questions, max_attempts, due_at, module_title').eq('linked_day_id', dayId).eq('published', true).is('deleted_at', null),
  ])

  if (day.day_name) {
    const allDayQuizzes = (dayQuizData ?? []) as Array<{ id: string; title: string; questions: unknown[]; max_attempts: number | null; due_at: string | null; module_title: string }>
    quizzes = allDayQuizzes.filter(q => {
      if (q.module_title?.trim() === module?.title?.trim()) return true
      const quizWeek = q.module_title?.match(/^Week\s+(\d+)/i)?.[1]
      return !!(quizWeek && weekNumber !== null && parseInt(quizWeek, 10) === weekNumber)
    })
  }

  const crossQuizzes = ((crossQuizData ?? []) as Array<{ id: string; title: string; questions: unknown[]; max_attempts: number | null; due_at: string | null; module_title: string }>)
    .filter(q => !quizzes.some(existing => existing.id === q.id))
    .map(q => ({ ...q, careerDev: true as const }))
  quizzes = [...quizzes, ...crossQuizzes]

  if (quizzes.length > 0) {
    const quizIds = quizzes.map(q => q.id)
    const { data: subData } = await supabase
      .from('quiz_submissions')
      .select('quiz_id, score_percent, attempt_count')
      .eq('student_id', user.id)
      .in('quiz_id', quizIds)
    quizSubmissions = (subData ?? []) as typeof quizSubmissions
  }

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}
      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>
        <div className="flex-1 min-w-0">
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
          {/* Wikis */}
          {dayWikis && dayWikis.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Wikis</h3>
              <div className="flex flex-col gap-2">
                {dayWikis.map(wiki => (
                  <WikiView key={wiki.id} wiki={wiki} />
                ))}
              </div>
            </section>
          )}

          {/* Resources */}
          <section>
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Resources</h3>
            {resources && resources.length > 0 ? (
              <DayResourceList
                resources={resources.map(r => ({ ...r, careerDev: r.linked_day_id === dayId }))}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-dark-text">{assignment.title}</p>
                          {assignment.is_bonus && (
                            <span className="text-xs font-medium bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-2 py-0.5">Bonus</span>
                          )}
                          {'careerDev' in assignment && assignment.careerDev && (
                            <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5">Career Dev</span>
                          )}
                        </div>
                        {(assignment.skill_tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(assignment.skill_tags ?? []).map(tag => (
                              <span key={tag} className="text-xs bg-teal-light text-teal-primary border border-teal-primary/30 rounded-full px-2 py-0.5">{tag}</span>
                            ))}
                          </div>
                        )}
                        {assignment.description && (
                          <p className="text-sm text-muted-text mt-1 line-clamp-2">{stripHtml(assignment.description)}</p>
                        )}
                        {(() => {
                          const override = dayOverrideMap.get(assignment.id)
                          const effectiveDue = override?.due_date ?? assignment.due_date
                          const excused = override?.excused ?? false
                          return (
                            <>
                              {excused && (
                                <span className="badge-amber text-xs font-medium border rounded-full px-2 py-0.5">Excused</span>
                              )}
                              {!excused && effectiveDue && (
                                <p className="text-xs text-muted-text mt-2">
                                  Due {new Date(effectiveDue).toLocaleDateString('en-US', {
                                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                                  })}
                                </p>
                              )}
                            </>
                          )
                        })()}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-dark-text">{displayTitle}</p>
                            {quiz.careerDev && (
                              <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5">Career Dev</span>
                            )}
                          </div>
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
        </div>
      </div>
    </div>
  )
}

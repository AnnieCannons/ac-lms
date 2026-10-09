import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import StudentPageBanner from '@/components/ui/StudentPageBanner'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'

/** Ungraded practice quizzes (quizzes.is_practice), reached from the Level Up page. */
export default async function PracticeQuizzesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getStudentCourseViewer(id)
  const { supabase } = viewer

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()
  if (!course) redirect('/student/courses')

  const admin = createServiceSupabaseClient()
  const { data: quizzes } = await admin
    .from('quizzes')
    .select('id, title, module_title, questions')
    .eq('course_id', id)
    .eq('is_practice', true)
    .eq('published', true)
    .is('deleted_at', null)
    .order('module_title', { ascending: true })
    .order('title', { ascending: true })

  const quizList = quizzes ?? []
  const { data: submissions } = quizList.length > 0
    ? await admin
        .from('quiz_submissions')
        .select('quiz_id, score_percent, attempt_count')
        .eq('student_id', viewer.viewerId)
        .in('quiz_id', quizList.map(q => q.id))
    : { data: [] }
  const subMap = new Map((submissions ?? []).map(s => [s.quiz_id, s]))

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={viewer.viewerName} role={viewer.viewerRole} />
      <StudentPageBanner viewer={viewer} courseId={id} />
      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-2">
              <Link href={`/student/courses/${id}/level-up`} className="text-muted-text hover:text-teal-primary text-sm">
                ← Level Up Your Skills
              </Link>
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Practice quizzes</h1>
              <p className="text-muted-text text-sm">Ungraded — they don&apos;t count toward anything. Retake them as often as you like.</p>
            </div>

            {quizList.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No practice quizzes yet. Check back later!</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {quizList.map(quiz => {
                  const sub = subMap.get(quiz.id)
                  const score = sub?.score_percent != null ? Math.round(sub.score_percent as number) : null
                  const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0
                  const title = quiz.title?.startsWith('Quiz: ') ? quiz.title.slice(6) : quiz.title
                  // Read-only viewing never starts a retake
                  const href = sub && score !== 100 && !viewer.readOnly
                    ? `/student/courses/${id}/quizzes/${quiz.id}?retake=1`
                    : `/student/courses/${id}/quizzes/${quiz.id}`
                  return (
                    <li key={quiz.id}>
                      <Link href={href} className="block bg-surface rounded-2xl border border-border p-5 hover:border-teal-primary transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h2 className="font-semibold text-dark-text">{title}</h2>
                            {quiz.module_title && <p className="text-xs text-muted-text mt-1">{quiz.module_title}</p>}
                          </div>
                          {score === 100 && (
                            <span className="status-complete-btn shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border">100% ✓</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-text mt-2">
                          {questionCount} question{questionCount !== 1 ? 's' : ''}
                          {sub && <> · Score: {score ?? '—'}% · {sub.attempt_count ?? 1} attempt{(sub.attempt_count ?? 1) !== 1 ? 's' : ''}</>}
                        </p>
                        <p className="text-sm font-medium text-teal-primary mt-2">
                          {!sub ? 'Start' : score === 100 ? 'Review answers' : 'Try again'} <span aria-hidden="true">→</span>
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

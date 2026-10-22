import { redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { addDays, pacificDate } from '@/lib/cutting-edge'
import { expandQuizAttempts, type FlashcardSession, type PracticeQuiz } from '@/lib/study-activity'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import StudyActivityView from '@/components/ui/StudyActivityView'

export const dynamic = 'force-dynamic'

export default async function StudyActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile, isTa } = await getInstructorOrTaAccess(id, `/student/courses/${id}`)
  // Staff only: TAs don't see study habits. This must come before the service-role client,
  // which bypasses RLS, is used.
  if (isTa) redirect(`/instructor/courses/${id}`)

  const admin = createServiceSupabaseClient()
  const { data: course } = await admin.from('courses').select('id, name, start_date').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  const today = pacificDate(new Date())
  // Courses without a start date fall back to the default 15-week length.
  const courseStart: string = course.start_date && course.start_date <= today ? course.start_date : addDays(today, -104)

  const [{ data: enrollments }, { data: quizRows }] = await Promise.all([
    admin.from('course_enrollments').select('user_id').eq('course_id', id).eq('role', 'student'),
    admin
      .from('quizzes')
      .select('id, title, module_title, published')
      .eq('course_id', id)
      .eq('is_practice', true)
      .is('deleted_at', null)
      .order('module_title', { ascending: true })
      .order('title', { ascending: true }),
  ])

  const studentIds = (enrollments ?? []).map(e => e.user_id)
  const quizIds = (quizRows ?? []).map(q => q.id)

  const [{ data: users }, submissions, sessionRows] = await Promise.all([
    studentIds.length
      ? admin.from('users').select('id, name, email').in('id', studentIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
    quizIds.length && studentIds.length
      ? fetchAllRows<{ quiz_id: string; student_id: string; submitted_at: string; score_percent: number | null; attempt_history: unknown }>(
          (from, to) =>
            admin
              .from('quiz_submissions')
              .select('quiz_id, student_id, submitted_at, score_percent, attempt_history')
              .in('quiz_id', quizIds)
              .in('student_id', studentIds)
              .order('id')
              .range(from, to),
        )
      : Promise.resolve([]),
    studentIds.length
      ? fetchAllRows<{ user_id: string; started_at: string; cards_studied: number }>((from, to) =>
          admin
            .from('study_sessions')
            .select('user_id, started_at, cards_studied')
            .in('user_id', studentIds)
            .gte('started_at', `${addDays(courseStart, -1)}T00:00:00Z`)
            .order('id')
            .range(from, to),
        )
      : Promise.resolve([]),
  ])

  const students = (users ?? [])
    .map(u => ({ id: u.id, name: u.name || u.email || 'Unknown' }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const attempts = expandQuizAttempts(submissions)
  const attemptedQuizIds = new Set(attempts.map(a => a.quizId))
  // Drafts nobody has taken would only add empty rows.
  const quizzes: PracticeQuiz[] = (quizRows ?? [])
    .filter(q => q.published || attemptedQuizIds.has(q.id))
    .map(q => ({
      id: q.id,
      title: q.title?.startsWith('Quiz: ') ? q.title.slice(6) : q.title,
      moduleTitle: q.module_title,
    }))
  const sessions: FlashcardSession[] = sessionRows
    .filter(s => s.cards_studied > 0)
    .map(s => ({ studentId: s.user_id, at: s.started_at, cards: s.cards_studied }))

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        isTa={isTa}
        breadcrumbs={[
          { label: 'Courses', href: '/instructor/courses' },
          { label: course.name, href: `/instructor/courses/${id}` },
          { label: 'Study Activity' },
        ]}
      />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Study Activity</h1>
              <p className="text-sm text-muted-text">{course.name}</p>
              <p className="mt-1 text-sm text-muted-text">
                Practice quizzes and flashcards. A student counts as active on a day if they did either (Pacific time).
                Flashcards aren&apos;t tied to a course, so they include every deck a student studies.
              </p>
            </div>
            <StudyActivityView
              courseId={id}
              students={students}
              quizzes={quizzes}
              attempts={attempts}
              sessions={sessions}
              today={today}
              courseStart={courseStart}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

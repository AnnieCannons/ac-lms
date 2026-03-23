import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import CourseOutlineAccordion from '@/components/ui/CourseOutlineAccordion'
import PageRefresher from '@/components/ui/PageRefresher'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

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

  const preview = await isStudentPreview(id)

  if (!preview && (profile?.role === 'instructor' || profile?.role === 'admin')) {
    redirect(`/instructor/courses/${id}`)
  }

  // Verify learner is enrolled in this course
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
    .select('id, name, code, start_date, end_date, paid_learners')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: rawModules } = await supabase
    .from('modules')
    .select('*, module_days(id, day_name, order, deleted_at, assignments!module_day_id(id, title, due_date, published, order, skill_tags, is_bonus, deleted_at), resources!module_day_id(id, type, title, content, description, order, deleted_at))')
    .eq('course_id', id)
    .is('deleted_at', null)
    .not('title', 'ilike', '%DO NOT PUBLISH%')
    .order('order', { ascending: true })

  const modules = (rawModules ?? [])
    .filter(m => m.category === 'syllabus' && m.published === true)
    .map(m => ({
      ...m,
      module_days: (m.module_days ?? [])
        .filter((d: { deleted_at: string | null }) => !d.deleted_at)
        .map((d: { assignments?: Array<{ deleted_at: string | null }>; resources?: Array<{ deleted_at: string | null }> }) => ({
          ...d,
          assignments: (d.assignments ?? []).filter(a => !a.deleted_at),
          resources: (d.resources ?? []).filter(r => !r.deleted_at),
        })),
    }))

  const dayIds = modules.flatMap(m => (m.module_days ?? []).map((d: { id: string }) => d.id))

  const admin = createServiceSupabaseClient()
  const moduleIds = modules.map(m => m.id)

  const [{ data: submissions }, { data: stars }, { data: completions }, { data: quizData }, { data: crossAssignments }, { data: crossResources }, { data: moduleWikisData }] = await Promise.all([
    supabase.from('submissions').select('assignment_id, status, grade, submitted_at').eq('student_id', user.id),
    supabase.from('resource_stars').select('resource_id').eq('user_id', user.id),
    supabase.from('resource_completions').select('resource_id').eq('user_id', user.id),
    admin.from('quizzes').select('id, title, module_title, day_title, linked_day_id, max_attempts, due_at').eq('course_id', id).eq('published', true).is('deleted_at', null).or('day_title.not.is.null,linked_day_id.not.is.null'),
    dayIds.length > 0
      ? supabase.from('assignments').select('id, title, due_date, published, module_day_id, linked_day_id').in('linked_day_id', dayIds).eq('published', true).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    dayIds.length > 0
      ? supabase.from('resources').select('id, type, title, content, description, order, linked_day_id').in('linked_day_id', dayIds).is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    moduleIds.length > 0
      ? admin.from('wikis').select('id, title, content, module_id').in('module_id', moduleIds).eq('published', true).order('order', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  type CourseQuiz = { id: string; title: string; module_title: string; day_title: string | null; linked_day_id: string | null; max_attempts: number | null; due_at: string | null }
  const quizzes = (quizData ?? []) as CourseQuiz[]

  // Inject cross-posted assignments and resources into the module day structure
  const crossAssignmentsArr = (crossAssignments ?? []) as Array<{ id: string; title: string; due_date: string | null; published: boolean; module_day_id: string; linked_day_id: string | null }>
  const crossResourcesArr = (crossResources ?? []) as Array<{ id: string; type: string; title: string; content: string | null; description: string | null; order: number; linked_day_id: string | null }>

  type ModuleWikiRow = { id: string; title: string; content: string; module_id: string | null }
  const moduleWikis = (moduleWikisData ?? []) as ModuleWikiRow[]

  // Build a mutable copy of modules to inject cross-posted data and wikis
  const modulesWithCross = modules.map(m => ({
    ...m,
    wikis: moduleWikis.filter(w => w.module_id === m.id),
    module_days: (m.module_days ?? []).map((d: { id: string; day_name: string; order: number; assignments?: unknown[]; resources?: unknown[] }) => {
      const extraAssignments = crossAssignmentsArr
        .filter(a => a.linked_day_id === d.id)
        .map(a => ({ ...a, careerDev: true }))
      const extraResources = crossResourcesArr
        .filter(r => r.linked_day_id === d.id)
        .map(r => ({ ...r, careerDev: true }))
      return {
        ...d,
        assignments: [...(d.assignments ?? []), ...extraAssignments],
        resources: [...(d.resources ?? []), ...extraResources],
      }
    }),
  }))

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, { status: s.status, grade: s.grade ?? null, submitted_at: s.submitted_at ?? null }])
  )
  const starredIds = (stars ?? []).map(s => s.resource_id)
  const completedIds = (completions ?? []).map(c => c.resource_id)

  const currentWeek = getCurrentWeek(course.start_date)

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}

      <div className="flex">
        {/* Left sidebar */}
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-10 focus:outline-none">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← My Courses
              </Link>
            </div>

            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-dark-text mb-1">Course Outline</h1>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className="text-muted-text text-sm">{course.code}</p>
                  {course.start_date && (
                    <p className="text-muted-text text-sm">
                      {new Date(course.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {course.end_date && ` – ${new Date(course.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  )}
                  {currentWeek && (
                    <a href={`#week-${currentWeek}`} className="bg-teal-light text-teal-primary text-xs font-semibold px-3 py-1 rounded-full hover:opacity-80 transition-opacity">
                      Week {currentWeek} this week
                    </a>
                  )}
                </div>
              </div>
              <a
                href={`/student/courses/${id}/info#syllabus`}
                className="text-sm font-medium text-teal-primary border border-teal-primary/40 px-4 py-2 rounded-lg hover:bg-teal-light transition-colors shrink-0"
              >
                Syllabus
              </a>
            </div>

            <PageRefresher />
            {modules.length > 0 ? (
              <CourseOutlineAccordion
                modules={modulesWithCross as Parameters<typeof CourseOutlineAccordion>[0]['modules']}
                courseId={id}
                currentWeek={currentWeek}
                submissionMap={submissionMap}
                initialStarredIds={starredIds}
                initialCompletedIds={completedIds}
                quizzes={quizzes}
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

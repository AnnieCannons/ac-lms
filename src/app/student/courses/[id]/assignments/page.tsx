import StudentPageBanner from '@/components/ui/StudentPageBanner'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import ResourceOutline from '@/components/ui/ResourceOutline'
import PageRefresher from '@/components/ui/PageRefresher'
import { getStudentOverrides } from '@/lib/student-overrides'

export const dynamic = 'force-dynamic'

export default async function StudentAssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getStudentCourseViewer(id)
  const { supabase, studentDb, viewerId } = viewer

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: rawModules } = await supabase
    .from('modules')
    .select('id, title, week_number, order, category, module_days(id, day_name, order, deleted_at, assignments!module_day_id(id, title, due_date, published, is_bonus, is_optional, submission_required, deleted_at))')
    .eq('course_id', id)
    .eq('published', true)
    .is('deleted_at', null)
    .order('order', { ascending: true })

  // Filter bonus assignments out — they belong to Level Up only; also filter trashed items
  const publishedModules = (rawModules ?? [])
    .filter(m => !m.title?.includes('DO NOT PUBLISH'))
    .map(m => ({
      ...m,
      module_days: (m.module_days ?? [])
        .filter((d: { deleted_at: string | null }) => !d.deleted_at)
        .map((d: { id: string; day_name: string; order: number; assignments?: Array<{ id: string; title: string; due_date: string | null; published: boolean; is_bonus?: boolean; deleted_at?: string | null }> }) => ({
          ...d,
          assignments: (d.assignments ?? []).filter((a) => a.published && !a.deleted_at),
        })),
    }))


  const allAssignmentIds = publishedModules.flatMap(m =>
    m.module_days.flatMap((d: { assignments: Array<{ id: string }> }) => d.assignments.map((a: { id: string }) => a.id))
  )

  const [{ data: submissions }, overrides] = await Promise.all([
    studentDb
      .from('submissions')
      .select('id, assignment_id, status, grade, submitted_at, is_late')
      .eq('student_id', viewerId),
    getStudentOverrides(viewerId, allAssignmentIds),
  ])

  const excusedSet = new Set([...overrides].filter(([, o]) => o.excused).map(([id]) => id))

  // Show the student's own (extended) due date, so Late / Past Due / filters all use it
  const modules = publishedModules.map(m => ({
    ...m,
    module_days: m.module_days.map((d: { assignments: Array<{ id: string; due_date: string | null }> }) => ({
      ...d,
      assignments: d.assignments.map(a => ({ ...a, due_date: overrides.get(a.id)?.due_date ?? a.due_date })),
    })),
  }))

  const submissionIds = (submissions ?? []).map(s => s.id)
  const { data: commentedSubs } = submissionIds.length > 0
    ? await studentDb
        .from('submission_comments')
        .select('submission_id')
        .in('submission_id', submissionIds)
    : { data: [] }

  const commentedSubIds = new Set((commentedSubs ?? []).map(c => c.submission_id))

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, {
      status: s.status,
      grade: s.grade ?? null,
      submitted_at: s.submitted_at ?? null,
      is_late: s.is_late ?? null,
      hasComments: commentedSubIds.has(s.id),
      excused: excusedSet.has(s.assignment_id),
    }])
  )

  // Add excused-only entries for assignments with no submission row
  for (const assignmentId of excusedSet) {
    if (!submissionMap[assignmentId]) {
      submissionMap[assignmentId] = { status: 'draft', grade: null, excused: true }
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={viewer.viewerName} role={viewer.viewerRole} />
      <StudentPageBanner viewer={viewer} courseId={id} />

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← My Courses
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Grades</h1>
              <p className="text-muted-text text-sm">{course.code}</p>
            </div>

            <PageRefresher />
            <ResourceOutline
              modules={modules as Parameters<typeof ResourceOutline>[0]['modules']}
              courseId={id}
              mode="assignments"
              submissionMap={submissionMap}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

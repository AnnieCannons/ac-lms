import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import StudentDetailView, { type CategorizedAssignment } from '@/components/ui/StudentDetailView'
import ViewAsStudentButton from '@/components/ui/ViewAsStudentButton'
import { localDate, todayLocal } from '@/lib/date-utils'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id: courseId, userId } = await params

  const { profile } = await getInstructorOrTaAccess(courseId)

  const admin = createServiceSupabaseClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', courseId)
    .single()

  if (!course) redirect('/instructor/courses')

  const { data: student } = await admin
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single()

  if (!student) redirect(`/instructor/courses/${courseId}/roster`)

  // Verify this user is enrolled in the course
  const { data: enrollment } = await admin
    .from('course_enrollments')
    .select('role')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!enrollment) redirect(`/instructor/courses/${courseId}/roster`)

  // Parallel fetches
  const [
    { data: accommodation },
    authResult,
    { data: rawModules },
  ] = await Promise.all([
    admin.from('accommodations').select('camera_off, notes').eq('user_id', userId).maybeSingle(),
    admin.auth.admin.getUserById(userId).catch(() => ({ data: { user: null }, error: null })),
    admin
      .from('modules')
      .select('id, title, week_number, order, module_days(id, order, assignments!module_day_id(id, title, due_date, published, canvas_assignment_id, deleted_at))')
      .eq('course_id', courseId)
      .eq('published', true)
      .eq('category', 'syllabus')
      .is('deleted_at', null)
      .not('title', 'ilike', '%DO NOT PUBLISH%')
      .order('order', { ascending: true }),
  ])

  const lastSignInAt: string | null =
    (authResult as { data: { user: { last_sign_in_at?: string } | null } }).data?.user?.last_sign_in_at ?? null

  // Flatten to all published assignments with module context
  type RawAssignment = { id: string; title: string; due_date: string | null; published: boolean; canvas_assignment_id: number | null; deleted_at: string | null }
  const allAssignments: (Omit<CategorizedAssignment, 'isLate'> & { canvasAssignmentId: number | null })[] = (rawModules ?? []).flatMap(m => {
    const days = (m.module_days ?? []) as { id: string; assignments: RawAssignment[] }[]
    return days.flatMap(d =>
      (d.assignments ?? [])
        .filter(a => a.published && !a.deleted_at)
        .map(a => ({
          id: a.id,
          title: a.title,
          due_date: a.due_date,
          moduleTitle: m.title ?? '',
          weekNumber: m.week_number ?? null,
          submissionId: null as string | null,
          canvasAssignmentId: a.canvas_assignment_id ?? null,
        }))
    )
  })

  const assignmentIds = allAssignments.map(a => a.id)

  const [
    { data: submissions },
    { data: quizzes },
    { data: overrideRows },
  ] = await Promise.all([
    assignmentIds.length > 0
      ? admin
          .from('submissions')
          .select('id, assignment_id, status, grade, submitted_at')
          .eq('student_id', userId)
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [] }),
    admin
      .from('quizzes')
      .select('id, title, module_title, due_at')
      .eq('course_id', courseId)
      .eq('published', true)
      .is('deleted_at', null),
    assignmentIds.length > 0
      ? admin
          .from('assignment_overrides')
          .select('assignment_id, due_date, excused')
          .eq('student_id', userId)
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [] }),
  ])

  const quizIds = (quizzes ?? []).map(q => q.id)
  const { data: quizSubmissions } = quizIds.length > 0
    ? await admin
        .from('quiz_submissions')
        .select('quiz_id, submitted_at, score_percent')
        .eq('student_id', userId)
        .in('quiz_id', quizIds)
    : { data: [] }

  // Categorize assignments
  const subMap = new Map((submissions ?? []).map(s => [s.assignment_id, s as { id: string; assignment_id: string; status: string; grade: string | null; submitted_at: string | null }]))
  const overrideMap = new Map((overrideRows ?? []).map(o => [o.assignment_id, o as { assignment_id: string; due_date: string | null; excused: boolean }]))

  const missing: CategorizedAssignment[] = []
  const late: CategorizedAssignment[] = []
  const submitted: CategorizedAssignment[] = []
  const complete: CategorizedAssignment[] = []
  const incomplete: CategorizedAssignment[] = []

  for (const a of allAssignments) {
    const sub = subMap.get(a.id)
    const override = overrideMap.get(a.id)
    if (override?.excused) continue
    const effectiveDueDate = override?.due_date ?? a.due_date
    const duePassed = effectiveDueDate ? localDate(effectiveDueDate) < todayLocal() : false
    const isLate = !!(
      sub?.submitted_at &&
      effectiveDueDate &&
      sub.submitted_at.slice(0, 10) > effectiveDueDate
    )
    const entry: CategorizedAssignment = { ...a, isLate, submissionId: sub?.id ?? null, type: 'assignment' }

    if (!sub || sub.status === 'draft') {
      if (duePassed && a.canvasAssignmentId) missing.push(entry)
    } else if (sub.status === 'submitted') {
      submitted.push(entry)
      if (isLate) late.push(entry)
    } else if (sub.status === 'graded') {
      if (isLate && sub.grade !== 'complete') late.push(entry)
      if (sub.grade === 'complete') complete.push(entry)
      else if (sub.grade === 'incomplete') incomplete.push(entry)
    }
  }

  // Categorize quizzes
  const quizSubMap = new Map((quizSubmissions ?? []).map(s => [s.quiz_id, s]))
  for (const q of (quizzes ?? [])) {
    const sub = quizSubMap.get(q.id)
    const duePassed = q.due_at ? localDate(q.due_at) < todayLocal() : false
    const displayTitle = q.title?.startsWith('Quiz: ') ? q.title.slice(6) : q.title
    const isLate = !!(sub?.submitted_at && q.due_at && sub.submitted_at > q.due_at)
    const entry: CategorizedAssignment = {
      id: q.id,
      title: displayTitle ?? '',
      due_date: q.due_at ?? null,
      moduleTitle: q.module_title ?? '',
      weekNumber: null,
      isLate,
      submissionId: null,
      type: 'quiz',
      score: sub?.score_percent ?? null,
    }
    if (!sub) {
      if (duePassed) missing.push(entry)
    } else {
      const score = sub.score_percent ?? 0
      if (score >= 100) complete.push(entry)
      else incomplete.push(entry)
      if (isLate) late.push(entry)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${courseId}` }, { label: 'Roster', href: `/instructor/courses/${courseId}/roster` }, { label: student.name ?? '' }]} />

      <div className="flex">
        <InstructorSidebar courseId={courseId} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Link
                href={`/instructor/courses/${courseId}/roster`}
                className="text-sm text-muted-text hover:text-teal-primary"
              >
                ← Roster
              </Link>
              {profile?.role === 'admin' && (
                <ViewAsStudentButton
                  studentId={student.id}
                  studentName={student.name ?? student.email ?? 'Student'}
                  courseId={courseId}
                />
              )}
            </div>

            <StudentDetailView
              courseId={courseId}
              student={{
                id: student.id,
                name: student.name ?? '',
                email: student.email ?? '',
                role: student.role ?? 'student',
              }}
              accommodation={
                accommodation
                  ? { cameraOff: accommodation.camera_off ?? false, notes: accommodation.notes ?? '' }
                  : null
              }
              lastSignInAt={lastSignInAt}
              missing={missing}
              late={late}
              submitted={submitted}
              complete={complete}
              incomplete={incomplete}
              totalPublished={missing.length + submitted.length + complete.length + incomplete.length}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

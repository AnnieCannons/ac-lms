import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import SubmissionsList, { type StudentRow } from '@/components/ui/SubmissionsList'
import AnswerKeyField from '@/components/ui/AnswerKeyField'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { formatDueDate } from '@/lib/date-utils'

export default async function InstructorSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assignmentId: string }>
  searchParams: Promise<{ grader?: string }>
}) {
  const { id, assignmentId } = await params
  const { grader } = await searchParams
  const isGraderMode = grader === 'all' || grader === 'me'
  const graderParam = isGraderMode ? grader as 'all' | 'me' : undefined

  const { user, profile, isTa } = await getInstructorOrTaAccess(id)

  // Use service role for cross-user queries (bypasses RLS)
  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect(`/instructor/courses/${id}`) }

  const { data: assignment } = await admin
    .from('assignments')
    .select('id, title, due_date, answer_key_url, submission_required, grader_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) redirect(`/instructor/courses/${id}`)

  const [
    { data: course },
    { data: enrollments },
    { data: submissions },
    { data: history },
  ] = await Promise.all([
    admin.from('courses').select('id, name').eq('id', id).single(),
    admin.from('course_enrollments').select('user_id, users(id, name)').eq('course_id', id).eq('role', 'student'),
    admin.from('submissions').select('id, student_id, submission_type, content, status, grade, submitted_at').eq('assignment_id', assignmentId),
    admin.from('submission_history').select('id, student_id, submitted_at').eq('assignment_id', assignmentId),
  ])

  // Build history count per student
  const historyCountByStudent = new Map<string, number>()
  for (const entry of history ?? []) {
    historyCountByStudent.set(entry.student_id, (historyCountByStudent.get(entry.student_id) ?? 0) + 1)
  }

  const submissionMap = new Map((submissions ?? []).map(s => [s.student_id, s]))

  const students: StudentRow[] = (enrollments ?? [])
    .map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      const sub = submissionMap.get(e.user_id) ?? null
      return {
        id: e.user_id,
        name: (u as { name: string } | null)?.name ?? 'Unknown',
        submission: sub as StudentRow['submission'],
        historyCount: historyCountByStudent.get(e.user_id) ?? 0,
        latestSubmittedAt: sub?.submitted_at ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // For grader=me, filter students to current user's group
  let displayStudents = students
  if (grader === 'me') {
    const { data: myGroups } = await admin
      .from('grading_groups')
      .select('student_id')
      .eq('course_id', id)
      .eq('grader_id', user.id)
    const myStudentIds = new Set(myGroups?.map(g => g.student_id) ?? [])
    const assignmentGraderOverride = (assignment as typeof assignment & { grader_id: string | null })?.grader_id ?? null
    if (assignmentGraderOverride === user.id) {
      displayStudents = students // I'm the override grader — all students
    } else if (assignmentGraderOverride !== null) {
      displayStudents = [] // Someone else is override grader
    } else {
      displayStudents = students.filter(s => myStudentIds.has(s.id))
    }
  }

  const turnedInCount = displayStudents.filter(s =>
    s.submission?.status === 'submitted' || s.submission?.status === 'graded'
  ).length
  const gradedCount = displayStudents.filter(s => s.submission?.status === 'graded').length
  const needsGradingCount = displayStudents.filter(s => s.submission?.status === 'submitted').length

  // First ungraded student for "Grade all ungraded →" CTA
  const firstUngradedStudent = displayStudents.find(s => s.submission?.status === 'submitted') ?? null

  // In grader mode, skip the list and go straight to the first ungraded student's page
  if (isGraderMode && firstUngradedStudent) {
    redirect(`/instructor/courses/${id}/assignments/${assignmentId}/submissions/${firstUngradedStudent.id}?grader=${graderParam}`)
  }

  // Grader mode: build ordered list of assignments with ungraded submissions for assignment navigation
  let graderPrev: { id: string; title: string } | null = null
  let graderNext: { id: string; title: string } | null = null
  let graderPosition = 0
  let graderTotal = 0

  if (isGraderMode) {
    const { data: allModules } = await admin
      .from('modules')
      .select('order, module_days(order, assignments!module_day_id(id, title, order))')
      .eq('course_id', id)

    type GraderDay = { order: number; assignments: { id: string; title: string; order: number }[] }
    type GraderModule = { order: number; module_days: GraderDay[] }

    const orderedAssignments = (allModules as GraderModule[] ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .flatMap(m =>
        (m.module_days ?? [])
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .flatMap(d =>
            (d.assignments ?? [])
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map(a => ({ id: a.id, title: a.title }))
          )
      )

    const allAssignmentIds = orderedAssignments.map(a => a.id)
    if (allAssignmentIds.length > 0) {
      const { data: ungradedSubData } = await admin
        .from('submissions')
        .select('assignment_id')
        .in('assignment_id', allAssignmentIds)
        .eq('status', 'submitted')

      const ungradedSet = new Set(ungradedSubData?.map(s => s.assignment_id) ?? [])
      const ungradedAssignments = orderedAssignments.filter(a => ungradedSet.has(a.id))
      const currentIdx = ungradedAssignments.findIndex(a => a.id === assignmentId)
      graderTotal = ungradedAssignments.length
      graderPosition = currentIdx + 1
      graderPrev = currentIdx > 0 ? ungradedAssignments[currentIdx - 1] : null
      graderNext = currentIdx < ungradedAssignments.length - 1 ? ungradedAssignments[currentIdx + 1] : null
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course?.name ?? '', href: `/instructor/courses/${id}` }, { label: 'Grades', href: `/instructor/courses/${id}/assignments` }, { label: assignment.title, href: `/instructor/courses/${id}/assignments/${assignmentId}` }, { label: 'Submissions' }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course?.name ?? ''} />

        <main className="flex-1 min-w-0 px-10 py-12 max-w-5xl">
        {/* Grader mode assignment nav strip */}
        {isGraderMode && (
          <div className="flex items-center justify-between bg-surface rounded-xl border border-border px-5 py-3 mb-6 gap-4">
            <div className="w-1/3">
              {graderPrev ? (
                <Link
                  href={`/instructor/courses/${id}/assignments/${graderPrev.id}/submissions?grader=${graderParam}`}
                  className="text-sm text-muted-text hover:text-teal-primary transition-colors flex items-center gap-1 truncate"
                >
                  <span className="shrink-0">←</span>
                  <span className="truncate">{graderPrev.title}</span>
                </Link>
              ) : (
                <span className="text-sm text-border">← First</span>
              )}
            </div>
            <div className="text-center shrink-0">
              <p className="text-xs font-semibold text-dark-text">{graderPosition} / {graderTotal} assignments</p>
              <Link href={`/instructor/courses/${id}/submissions`} className="text-xs text-teal-primary hover:underline">
                Back to grades
              </Link>
            </div>
            <div className="w-1/3 text-right">
              {graderNext ? (
                <Link
                  href={`/instructor/courses/${id}/assignments/${graderNext.id}/submissions?grader=${graderParam}`}
                  className="text-sm text-muted-text hover:text-teal-primary transition-colors flex items-center gap-1 justify-end truncate"
                >
                  <span className="truncate">{graderNext.title}</span>
                  <span className="shrink-0">→</span>
                </Link>
              ) : (
                <span className="text-sm text-border">Last →</span>
              )}
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}/submissions`} className="hover:text-teal-primary">{course?.name}</Link>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium truncate max-w-[300px]">{assignment.title}</span>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">Submissions</span>
        </div>

        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-dark-text">{assignment.title}</h1>
          {!assignment.submission_required && (
            <span className="status-late-badge text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">
              No submission
            </span>
          )}
        </div>
        {assignment.due_date && (
          <p className="text-xs text-muted-text mt-1">
            Due {formatDueDate(assignment.due_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <AnswerKeyField assignmentId={assignmentId} courseId={id} initialUrl={assignment.answer_key_url ?? null} />

        {/* Stats */}
        <div className="flex items-center gap-6 mb-8 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-bold text-dark-text">{students.length}</p>
            <p className="text-xs text-muted-text">Enrolled</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-teal-primary">{turnedInCount}</p>
            <p className="text-xs text-muted-text">Turned in</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{needsGradingCount}</p>
            <p className="text-xs text-muted-text">Needs grading</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-primary">{gradedCount}</p>
            <p className="text-xs text-muted-text">Graded</p>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No students enrolled.</p>
          </div>
        ) : (
          <SubmissionsList
            students={displayStudents}
            courseId={id}
            assignmentId={assignmentId}
            submissionRequired={assignment.submission_required}
            currentUserId={user.id}
            initialFilter={needsGradingCount > 0 ? 'needs-grading' : 'all'}
            firstUngradedStudentId={firstUngradedStudent?.id ?? null}
            grader={graderParam}
          />
        )}
        </main>
      </div>
    </div>
  )
}

import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import HtmlContent from '@/components/ui/HtmlContent'
import GradeButtons from '@/components/ui/GradeButtons'
import InstructorChecklist from '@/components/ui/InstructorChecklist'
import SubmissionComments, { type CommentEntry } from '@/components/ui/SubmissionComments'
import SubmissionFilePreview from '@/components/ui/SubmissionFilePreview'
import AnswerKeyField from '@/components/ui/AnswerKeyField'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import MarkdownContent from '@/components/ui/MarkdownContent'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { normalizeUrl } from '@/lib/url'

type SubmissionType = 'text' | 'link' | 'file'

function SubmissionContent({ type, content }: { type: SubmissionType; content: string | null }) {
  if (!content) return <p className="text-muted-text italic text-sm">No content</p>
  if (type === 'file') {
    return <SubmissionFilePreview content={content} />
  }
  if (type === 'link') {
    return (
      <a href={normalizeUrl(content)} target="_blank" rel="noopener noreferrer"
        className="text-teal-primary underline break-all text-sm">
        {content}
      </a>
    )
  }
  return <MarkdownContent content={content} />
}

export default async function GradingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assignmentId: string; studentId: string }>
  searchParams: Promise<{ grader?: string }>
}) {
  const { id, assignmentId, studentId } = await params
  const { grader } = await searchParams
  const isGraderMode = grader === 'all' || grader === 'me'

  const { user, profile, isTa } = await getInstructorOrTaAccess(id)

  // Use service role for cross-user queries (bypasses RLS)
  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect(`/instructor/courses/${id}`) }

  const { data: assignment } = await admin
    .from('assignments')
    .select('id, title, description, how_to_turn_in, due_date, answer_key_url, submission_required, grader_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) redirect(`/instructor/courses/${id}`)

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  const { data: student } = await admin
    .from('users')
    .select('id, name')
    .eq('id', studentId)
    .single()

  // Fetch all enrolled students + all submissions to build navigation
  const [{ data: enrollments }, { data: allSubmissions }] = await Promise.all([
    admin
      .from('course_enrollments')
      .select('user_id, users(id, name)')
      .eq('course_id', id)
      .eq('role', 'student'),
    admin
      .from('submissions')
      .select('student_id, status')
      .eq('assignment_id', assignmentId),
  ])

  const allStudents = (enrollments ?? [])
    .map(e => { const u = Array.isArray(e.users) ? e.users[0] : e.users; return { id: e.user_id, name: (u as { name: string } | null)?.name ?? 'Unknown' } })
    .sort((a, b) => a.name.localeCompare(b.name))

  const submissionStatusMap = new Map((allSubmissions ?? []).map(s => [s.student_id, s.status]))

  // Ungraded queue: students with status = 'submitted' (needs grading)
  let ungradedStudents = allStudents.filter(s => submissionStatusMap.get(s.id) === 'submitted')
  const needsGradingTotal = ungradedStudents.length

  // For grader=me, filter ungraded queue to current user's group
  if (grader === 'me') {
    const { data: myGroups } = await admin
      .from('grading_groups')
      .select('student_id')
      .eq('course_id', id)
      .eq('grader_id', user.id)
    const myStudentIds = new Set(myGroups?.map(g => g.student_id) ?? [])
    const assignmentGraderOverride = (assignment as typeof assignment & { grader_id: string | null })?.grader_id ?? null
    if (assignmentGraderOverride !== user.id && assignmentGraderOverride !== null) {
      ungradedStudents = [] // someone else is override grader
    } else if (assignmentGraderOverride === null) {
      ungradedStudents = ungradedStudents.filter(s => myStudentIds.has(s.id))
    }
    // if override === user.id: keep all ungraded (I'm grading everyone for this assignment)
  }

  // In grader mode: navigate through ungraded students only; otherwise all students
  const navStudents = isGraderMode ? ungradedStudents : allStudents
  const currentNavIndex = navStudents.findIndex(s => s.id === studentId)
  const prevStudent = currentNavIndex > 0 ? navStudents[currentNavIndex - 1] : null
  const nextStudent = currentNavIndex < navStudents.length - 1 ? navStudents[currentNavIndex + 1] : null
  const studentPosition = currentNavIndex + 1
  const studentTotal = navStudents.length

  const subBase = `/instructor/courses/${id}/assignments/${assignmentId}/submissions`
  const graderSuffix = isGraderMode ? `?grader=${grader}` : ''

  // Grader mode: compute ordered ungraded assignments for assignment-level navigation
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
      // Include current assignment even if it's now fully graded (for position display)
      const ungradedAssignments = orderedAssignments.filter(a => ungradedSet.has(a.id) || a.id === assignmentId)
      const currentIdx = ungradedAssignments.findIndex(a => a.id === assignmentId)
      graderTotal = ungradedAssignments.length
      graderPosition = currentIdx + 1
      graderPrev = currentIdx > 0 ? ungradedAssignments[currentIdx - 1] : null
      graderNext = currentIdx < ungradedAssignments.length - 1 ? ungradedAssignments[currentIdx + 1] : null
    }
  }

  // nextUngradedStudent: next ungraded in this assignment, or first student of next assignment (via submissions page redirect)
  const nextUngradedStudent = isGraderMode
    ? (nextStudent ?? null)
    : (() => {
        const idx = ungradedStudents.findIndex(s => s.id === studentId)
        return idx >= 0 && idx < ungradedStudents.length - 1 ? ungradedStudents[idx + 1] : null
      })()

  let { data: submission } = await admin
    .from('submissions')
    .select('id, submission_type, content, status, grade, graded_at, submitted_at, student_comment')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()

  // For no-submission assignments, auto-create a placeholder so grading works normally
  if (!submission && assignment?.submission_required === false) {
    const { data: created } = await admin
      .from('submissions')
      .insert({ assignment_id: assignmentId, student_id: studentId, submission_type: 'text', content: null, status: 'submitted' })
      .select('id, submission_type, content, status, grade, graded_at, submitted_at, student_comment')
      .single()
    submission = created ?? null
  }

  const { data: submissionHistory } = await admin
    .from('submission_history')
    .select('id, submission_type, content, submitted_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })

  const { data: checklistItems } = await admin
    .from('checklist_items')
    .select('id, text, description, order')
    .eq('assignment_id', assignmentId)
    .order('order', { ascending: true })

  // Instructor's grading responses
  const { data: checklistResponses } = submission
    ? await admin
        .from('checklist_responses')
        .select('checklist_item_id, checked')
        .eq('submission_id', submission.id)
    : { data: [] }

  // Student's self-check progress
  const { data: studentProgress } = await admin
    .from('student_checklist_progress')
    .select('checklist_item_id, checked')
    .eq('student_id', studentId)
    .in('checklist_item_id', checklistItems?.map(i => i.id) ?? [])

  const studentCheckedIds = new Set(
    (studentProgress ?? []).filter(p => p.checked).map(p => p.checklist_item_id)
  )

  const { data: rawComments } = submission
    ? await admin
        .from('submission_comments')
        .select('id, content, created_at, author_id, users(name, role)')
        .eq('submission_id', submission.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const initialComments: CommentEntry[] = (rawComments ?? []).map(c => {
    const u = Array.isArray(c.users) ? c.users[0] : c.users
    return {
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      author_id: c.author_id,
      author_name: (u as { name: string; role: string } | null)?.name ?? 'Unknown',
      author_role: (u as { name: string; role: string } | null)?.role ?? 'instructor',
    }
  })

  const currentGrade = (submission?.grade ?? null) as 'complete' | 'incomplete' | null

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course?.name ?? '', href: `/instructor/courses/${id}` }, { label: 'Grades', href: `/instructor/courses/${id}/assignments` }, { label: assignment.title, href: `/instructor/courses/${id}/assignments/${assignmentId}/submissions` }, { label: student?.name ?? 'Student' }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course?.name ?? ''} />

        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-10 py-12 max-w-4xl focus:outline-none">
        {/* Grader mode: assignment nav strip */}
        {isGraderMode && (
          <div className="flex items-center justify-between bg-surface rounded-xl border border-border px-5 py-3 mb-3 gap-4">
            <div className="w-1/3">
              {graderPrev ? (
                <Link
                  href={`/instructor/courses/${id}/assignments/${graderPrev.id}/submissions?grader=${grader}`}
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
                  href={`/instructor/courses/${id}/assignments/${graderNext.id}/submissions?grader=${grader}`}
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
        <div className="flex items-center gap-2 text-sm text-muted-text mb-4 flex-wrap">
          <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">{course?.name}</Link>
          <span className="text-border">/</span>
          <Link href={subBase} className="hover:text-teal-primary truncate max-w-[200px]">{assignment.title}</Link>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">{student?.name ?? 'Student'}</span>
        </div>

        {/* Student nav strip */}
        <div className="flex items-center justify-between bg-surface rounded-xl border border-border px-5 py-3 mb-6 gap-4">
          <div className="w-1/3">
            {prevStudent ? (
              <Link href={`${subBase}/${prevStudent.id}${graderSuffix}`} className="text-sm text-muted-text hover:text-teal-primary transition-colors flex items-center gap-1 truncate">
                <span className="shrink-0">←</span>
                <span className="truncate">{prevStudent.name}</span>
              </Link>
            ) : (
              <span className="text-sm text-border">← First</span>
            )}
          </div>
          <div className="text-center shrink-0 flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-dark-text">
              {isGraderMode ? `${studentPosition} / ${studentTotal} ungraded` : `${studentPosition} / ${studentTotal}`}
            </p>
            {!isGraderMode && needsGradingTotal > 0 && (
              <p className="text-xs text-yellow-600 font-medium">{needsGradingTotal} need grading</p>
            )}
            <Link href={subBase} className="text-xs text-teal-primary hover:underline">Back to list</Link>
          </div>
          <div className="w-1/3 text-right">
            {nextStudent ? (
              <Link href={`${subBase}/${nextStudent.id}${graderSuffix}`} className="text-sm text-muted-text hover:text-teal-primary transition-colors flex items-center gap-1 justify-end truncate">
                <span className="truncate">{nextStudent.name}</span>
                <span className="shrink-0">→</span>
              </Link>
            ) : (
              <span className="text-sm text-border">Last →</span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <Link href={`/instructor/courses/${id}/roster/${studentId}`} className="text-2xl font-bold text-dark-text hover:text-teal-primary transition-colors">
              {student?.name ?? 'Student'}
            </Link>
            <Link href={`/instructor/courses/${id}/assignments/${assignmentId}`} className="text-base font-semibold text-teal-primary hover:underline transition-colors block truncate max-w-md">{assignment.title}</Link>
            <AnswerKeyField assignmentId={assignmentId} courseId={id} initialUrl={assignment.answer_key_url ?? null} />
          </div>
          {submission && (
            <GradeButtons
              submissionId={submission.id}
              initialGrade={currentGrade}
              initialGradedAt={submission.graded_at ?? null}
              gradedById={user.id}
              courseId={id}
              nextUrl={
                nextUngradedStudent
                  ? `${subBase}/${nextUngradedStudent.id}${graderSuffix}`
                  : isGraderMode && graderNext
                  ? `/instructor/courses/${id}/assignments/${graderNext.id}/submissions?grader=${grader}`
                  : null
              }
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Assignment instructions (collapsed reference) */}
          {assignment.description && (
            <details className="bg-surface rounded-2xl border border-border p-6 group">
              <summary className="text-xs font-semibold text-muted-text uppercase tracking-wide cursor-pointer list-none flex items-center justify-between">
                Assignment Instructions
                <span className="text-muted-text text-xs group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="mt-4">
                <HtmlContent
                  html={assignment.description}
                  className="text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_a]:text-teal-primary [&_a]:underline [&_p]:mb-3 [&_li]:mb-1"
                />
              </div>
            </details>
          )}

          {/* Submission */}
          {assignment.submission_required === false ? (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Submission</p>
              <p className="text-sm text-muted-text mt-2 italic">No submission — instructor check-off only.</p>
            </div>
          ) : null}
          {assignment.submission_required !== false && <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Submission</p>
              {submission && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  currentGrade === 'complete' ? 'status-complete-btn border' :
                  currentGrade === 'incomplete' ? 'status-revision-btn border' :
                  submission.status === 'submitted' ? 'bg-teal-light text-teal-primary border border-teal-primary' :
                  'status-draft-badge'
                }`}>
                  {currentGrade === 'complete' ? 'Complete' :
                   currentGrade === 'incomplete' ? 'Incomplete' :
                   submission.status === 'submitted' ? 'Turned in' : 'Draft'}
                </span>
              )}
            </div>

            {submission ? (
              <div className="flex flex-col gap-3">
                <div className="bg-background rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-text mb-2">
                    {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                  <SubmissionContent
                    type={submission.submission_type as SubmissionType}
                    content={submission.content}
                  />
                  {submission.student_comment && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Note from student</p>
                      <p className="text-sm text-dark-text whitespace-pre-wrap">{submission.student_comment}</p>
                    </div>
                  )}
                </div>

                {/* History */}
                {submissionHistory && submissionHistory.length > 1 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                      Past Submissions ({submissionHistory.length - 1})
                    </p>
                    {submissionHistory.slice(1).map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 text-xs bg-background rounded-lg px-3 py-2">
                        <span className="text-muted-text shrink-0 w-36">
                          {new Date(entry.submitted_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                        </span>
                        <div className="flex-1 min-w-0">
                          <SubmissionContent
                            type={entry.submission_type as SubmissionType}
                            content={entry.content}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-text italic">No submission yet.</p>
            )}
          </div>}

          {/* Checklist */}
          {checklistItems && checklistItems.length > 0 && submission && (
            <InstructorChecklist
              items={checklistItems.map(i => ({ id: i.id, text: i.text, description: i.description ?? null }))}
              initialResponses={checklistResponses ?? []}
              submissionId={submission.id}
              gradedById={user.id}
              courseId={id}
              studentCheckedIds={studentCheckedIds}
            />
          )}

          {/* Comments */}
          {submission && (
            <SubmissionComments
              submissionId={submission.id}
              initialComments={initialComments}
              currentUserId={user.id}
              currentUserName={profile?.name ?? 'Instructor'}
              currentUserRole={profile?.role ?? 'instructor'}
              isTa={isTa}
              courseId={id}
            />
          )}

        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border gap-4">
          <div className="w-1/3">
            {prevStudent ? (
              <Link href={`${subBase}/${prevStudent.id}${graderSuffix}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors truncate max-w-full">
                <span className="shrink-0">←</span>
                <span className="truncate">{prevStudent.name}</span>
              </Link>
            ) : null}
          </div>
          <Link href={subBase} className="text-sm text-muted-text hover:text-teal-primary transition-colors shrink-0">
            All submissions
          </Link>
          <div className="w-1/3 flex justify-end">
            {nextStudent ? (
              <Link href={`${subBase}/${nextStudent.id}${graderSuffix}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-text hover:border-teal-primary hover:text-teal-primary transition-colors truncate max-w-full">
                <span className="truncate">{nextStudent.name}</span>
                <span className="shrink-0">→</span>
              </Link>
            ) : null}
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import HtmlContent from '@/components/ui/HtmlContent'
import SubmissionForm from '@/components/ui/SubmissionForm'
import { type CommentEntry } from '@/components/ui/SubmissionComments'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import { localDate, formatDueDate, todayLocal } from '@/lib/date-utils'

export default async function StudentAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assignmentId: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  const { id, assignmentId } = await params
  const { filter: backFilter } = await searchParams
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

  const isObserver = !preview && enrollment?.role === 'observer'

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description, how_to_turn_in, due_date, module_day_id, published, submission_required, skill_tags, is_bonus')
    .eq('id', assignmentId)
    .eq('published', true)
    .single()

  if (!assignment) redirect(`/student/courses/${id}`)

  const { data: day } = await supabase
    .from('module_days')
    .select('id, day_name, module_id, modules(id, title, week_number, course_id)')
    .eq('id', assignment.module_day_id)
    .single()

  // Verify the assignment actually belongs to this course
  const dayModule = Array.isArray(day?.modules) ? day?.modules[0] : day?.modules
  if (!day || (dayModule as { course_id: string } | null)?.course_id !== id) {
    redirect(`/student/courses/${id}`)
  }

  let admin: ReturnType<typeof createServiceSupabaseClient> | null = null
  try { admin = createServiceSupabaseClient() } catch { /* service role key not configured */ }

  // checklist_items: RLS may restrict student reads, so use service role
  const { data: checklistItems } = admin
    ? await admin
        .from('checklist_items')
        .select('id, text, description, order, required')
        .eq('assignment_id', assignmentId)
        .order('order', { ascending: true })
    : await supabase
        .from('checklist_items')
        .select('id, text, description, order, required')
        .eq('assignment_id', assignmentId)
        .order('order', { ascending: true })

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()

  const { data: existingSubmission } = admin
    ? await admin
        .from('submissions')
        .select('id, submission_type, content, status, grade, submitted_at, student_comment')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle()
    : await supabase
        .from('submissions')
        .select('id, submission_type, content, status, grade, submitted_at')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle()

  const { data: submissionHistory } = await supabase
    .from('submission_history')
    .select('id, submission_type, content, submitted_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .order('submitted_at', { ascending: false })

  const { data: override } = admin
    ? await admin
        .from('assignment_overrides')
        .select('due_date, excused')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle()
    : { data: null }

  const effectiveDueDate = (override?.due_date ?? null) ? override!.due_date : assignment.due_date
  const isExcused = override?.excused ?? false

  // Instructor's checklist responses (read-only for student)
  const { data: instructorResponses } = (admin && existingSubmission)
    ? await admin
        .from('checklist_responses')
        .select('checklist_item_id, checked')
        .eq('submission_id', existingSubmission.id)
    : { data: [] }

  // Student's own checklist progress (use service role to bypass RLS)
  const { data: studentProgress } = admin
    ? await admin
        .from('student_checklist_progress')
        .select('checklist_item_id, checked')
        .eq('student_id', user.id)
        .in('checklist_item_id', (checklistItems ?? []).map(i => i.id))
    : { data: [] }

  const initialChecked: Record<string, boolean> = {}
  ;(checklistItems ?? []).forEach(i => { initialChecked[i.id] = false })
  ;(studentProgress ?? []).forEach(r => { initialChecked[r.checklist_item_id] = r.checked })

  const instructorResponseMap = new Map(
    (instructorResponses ?? []).map(r => [r.checklist_item_id, r.checked])
  )
  const hasInstructorReview = (instructorResponses ?? []).length > 0

  const { data: rawComments } = (admin && existingSubmission)
    ? await admin
        .from('submission_comments')
        .select('id, content, created_at, author_id, users(name, role)')
        .eq('submission_id', existingSubmission.id)
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

  const module = Array.isArray(day?.modules) ? day?.modules[0] : day?.modules

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}
      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course?.name ?? ''} paidLearners={course?.paid_learners ?? false} />
        </ResizableSidebar>
        <div className="flex-1 min-w-0">
      <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12 focus:outline-none">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/student/courses" className="hover:text-teal-primary">My Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/student/courses/${id}`} className="hover:text-teal-primary">{course?.name}</Link>
          {backFilter ? (
            <>
              <span className="text-border">/</span>
              <Link href={`/student/courses/${id}/assignments?filter=${backFilter}`} className="hover:text-teal-primary">
                Grades
              </Link>
            </>
          ) : day ? (
            <>
              <span className="text-border">/</span>
              <Link href={`/student/courses/${id}/days/${day.id}`} className="hover:text-teal-primary">
                {day.day_name}
              </Link>
            </>
          ) : null}
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium truncate max-w-[200px]">{assignment.title}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-dark-text mb-2">{assignment.title}</h1>
            {((assignment.skill_tags ?? []).length > 0 || assignment.is_bonus) && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {assignment.is_bonus && (
                  <span className="text-xs font-medium bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-2.5 py-1">Bonus</span>
                )}
                {(assignment.skill_tags ?? []).map((tag: string) => (
                  <span key={tag} className="text-xs font-medium bg-teal-light text-teal-primary border border-teal-primary/30 rounded-full px-2.5 py-1">{tag}</span>
                ))}
              </div>
            )}
          </div>
          {existingSubmission?.grade === 'complete' && (
            <span className="status-complete-btn shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border">
              Complete ✓
            </span>
          )}
          {existingSubmission?.grade === 'incomplete' && (
            <span className="status-revision-btn shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border">
              Needs Revision
            </span>
          )}
          {!isExcused && !existingSubmission && effectiveDueDate && localDate(effectiveDueDate) < todayLocal() && (
            <span className="status-late-badge shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border">
              Late
            </span>
          )}
          {isExcused && (
            <span className="badge-amber shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full border">
              Excused
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          {module && (
            <p className="text-muted-text text-sm">{module.title}</p>
          )}
          {effectiveDueDate && (() => {
            const isPast = localDate(effectiveDueDate) < todayLocal()
            const isResolved = existingSubmission?.grade === 'complete' || existingSubmission?.grade === 'incomplete' || existingSubmission?.status === 'submitted'
            return (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
                isPast && !isResolved && !isExcused
                  ? 'bg-amber-500/10 text-amber-700 border-amber-500'
                  : 'bg-surface text-muted-text border-border'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Due {formatDueDate(effectiveDueDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )
          })()}
        </div>

        <div className="flex flex-col gap-6">
          {/* Instructions */}
          {assignment.description && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">Instructions</p>
              <HtmlContent
                html={assignment.description}
                className="text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-bold [&_h2]:text-base [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:font-bold [&_a]:text-teal-primary [&_a]:underline [&_p]:mb-3 [&_li]:mb-1"
              />
            </div>
          )}

          {/* No checklist message */}
          {checklistItems && checklistItems.length === 0 && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Checklist</p>
              <p className="text-sm text-muted-text">There is no checklist for this assignment.</p>
            </div>
          )}

          {/* How to turn in */}
          {assignment.how_to_turn_in && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">How to turn this in</p>
              <HtmlContent
                html={assignment.how_to_turn_in}
                className="text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_a]:text-teal-primary [&_a]:underline [&_p]:mb-3"
              />
            </div>
          )}

          {/* Submission form (includes student checklist when items exist) */}
          {assignment.submission_required !== false ? (
            <SubmissionForm
              assignmentId={assignmentId}
              studentId={user.id}
              courseId={id}
              existingSubmission={existingSubmission ?? null}
              initialHistory={submissionHistory ?? []}
              checklistItems={checklistItems ?? undefined}
              initialChecked={initialChecked}
              instructorResponseMap={hasInstructorReview ? instructorResponseMap : undefined}
              isObserver={isObserver}
              isStudentPreview={preview}
              initialComments={initialComments}
              currentUserName={profile?.name ?? 'Student'}
              currentUserRole={profile?.role ?? 'student'}
            />
          ) : (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Submission</p>
              <p className="text-sm text-muted-text">No submission needed — your instructor will check this off directly.</p>
            </div>
          )}

        </div>
      </main>
        </div>
      </div>
    </div>
  )
}

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import HtmlContent from '@/components/ui/HtmlContent'
import SubmissionForm from '@/components/ui/SubmissionForm'
import StudentChecklist from '@/components/ui/StudentChecklist'
import SubmissionComments, { type CommentEntry } from '@/components/ui/SubmissionComments'

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>
}) {
  const { id, assignmentId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
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

  if (!enrollment) redirect('/student/courses')

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description, how_to_turn_in, due_date, module_day_id, published')
    .eq('id', assignmentId)
    .eq('published', true)
    .single()

  if (!assignment) redirect(`/student/courses/${id}`)

  const { data: day } = await supabase
    .from('module_days')
    .select('id, day_name, module_id, modules(id, title, week_number)')
    .eq('id', assignment.module_day_id)
    .single()

  const { data: checklistItems } = await supabase
    .from('checklist_items')
    .select('id, text, description, order')
    .eq('assignment_id', assignmentId)
    .order('order', { ascending: true })

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('id', id)
    .single()

  const { data: existingSubmission } = await supabase
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

  const admin = createServiceSupabaseClient()

  // Instructor's checklist responses (read-only for student)
  const { data: instructorResponses } = existingSubmission
    ? await admin
        .from('checklist_responses')
        .select('checklist_item_id, checked')
        .eq('submission_id', existingSubmission.id)
    : { data: [] }

  const instructorResponseMap = new Map(
    (instructorResponses ?? []).map(r => [r.checklist_item_id, r.checked])
  )
  const hasInstructorReview = (instructorResponses ?? []).length > 0

  const { data: rawComments } = existingSubmission
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
      author_role: (u as { name: string; role: string } | null)?.role ?? 'student',
    }
  })

  const module = Array.isArray(day?.modules) ? day?.modules[0] : day?.modules

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile?.name} · <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-8 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/student/courses" className="hover:text-teal-primary">My Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/student/courses/${id}`} className="hover:text-teal-primary">{course?.name}</Link>
          {day && (
            <>
              <span className="text-border">/</span>
              <Link href={`/student/courses/${id}/days/${day.id}`} className="hover:text-teal-primary">
                {day.day_name}
              </Link>
            </>
          )}
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium truncate max-w-[200px]">{assignment.title}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-2xl font-bold text-dark-text">{assignment.title}</h1>
          {existingSubmission?.grade === 'complete' && (
            <span className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full bg-teal-light text-teal-primary">
              Complete ✓
            </span>
          )}
          {existingSubmission?.grade === 'incomplete' && (
            <span className="shrink-0 text-sm font-semibold px-4 py-1.5 rounded-full bg-red-50 text-red-500">
              Needs Revision
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mb-8">
          {module && (
            <p className="text-muted-text text-sm">{module.title}</p>
          )}
          {assignment.due_date && (
            <p className="text-sm text-muted-text">
              Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}
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

          {/* Instructor Review (read-only) */}
          {checklistItems && checklistItems.length > 0 && hasInstructorReview && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Instructor Review</p>
                  <p className="text-xs text-muted-text mt-0.5">This checklist determines your grade.</p>
                </div>
                {existingSubmission?.grade === 'complete' && (
                  <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-teal-light text-teal-primary">Complete ✓</span>
                )}
                {existingSubmission?.grade === 'incomplete' && (
                  <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-red-50 text-red-500">Needs Revision</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {checklistItems.map(item => {
                  const checked = instructorResponseMap.get(item.id) === true
                  return (
                    <div key={item.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${checked ? 'border-teal-primary bg-teal-light/30' : 'border-border bg-background'}`}>
                      <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${checked ? 'bg-teal-primary border-teal-primary' : 'border-border'}`}>
                        {checked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${checked ? 'text-dark-text' : 'text-muted-text'}`}>{item.text}</p>
                        {item.description && (
                          <p className="text-xs text-muted-text mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Student Checklist */}
          {checklistItems && checklistItems.length > 0 && (
            <StudentChecklist assignmentId={assignmentId} studentId={user.id} items={checklistItems} />
          )}

          {/* Submission form */}
          <SubmissionForm
            assignmentId={assignmentId}
            studentId={user.id}
            existingSubmission={existingSubmission ?? null}
            initialHistory={submissionHistory ?? []}
          />

          {/* Comments (only shown once there's a submission) */}
          {existingSubmission && (
            <SubmissionComments
              submissionId={existingSubmission.id}
              initialComments={initialComments}
              currentUserId={user.id}
              currentUserName={profile?.name ?? 'Student'}
              currentUserRole={profile?.role ?? 'student'}
            />
          )}
        </div>
      </main>
    </div>
  )
}

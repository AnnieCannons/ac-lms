import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import HtmlContent from '@/components/ui/HtmlContent'
import GradeButtons from '@/components/ui/GradeButtons'
import InstructorChecklist from '@/components/ui/InstructorChecklist'
import SubmissionComments, { type CommentEntry } from '@/components/ui/SubmissionComments'

type SubmissionType = 'text' | 'link' | 'file'

function SubmissionContent({ type, content }: { type: SubmissionType; content: string | null }) {
  if (!content) return <p className="text-muted-text italic text-sm">No content</p>
  if (type === 'link' || type === 'file') {
    return (
      <a href={content} target="_blank" rel="noopener noreferrer"
        className="text-teal-primary underline break-all text-sm">
        {content}
      </a>
    )
  }
  return <p className="text-sm text-dark-text whitespace-pre-wrap break-words">{content}</p>
}

export default async function GradingPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string; studentId: string }>
}) {
  const { id, assignmentId, studentId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'student') redirect('/student/courses')

  // Use service role for cross-user queries (bypasses RLS)
  const admin = createServiceSupabaseClient()

  const { data: assignment } = await admin
    .from('assignments')
    .select('id, title, description, how_to_turn_in, due_date')
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

  const { data: submission } = await admin
    .from('submissions')
    .select('id, submission_type, content, status, grade, graded_at, submitted_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()

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
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
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
          <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">{course?.name}</Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}/assignments/${assignmentId}/submissions`} className="hover:text-teal-primary truncate max-w-[200px]">
            {assignment.title}
          </Link>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">{student?.name ?? 'Student'}</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">{student?.name ?? 'Student'}</h1>
            <p className="text-base font-semibold text-dark-text mt-1 truncate max-w-md">{assignment.title}</p>
          </div>
          {submission && (
            <GradeButtons
              submissionId={submission.id}
              initialGrade={currentGrade}
              initialGradedAt={submission.graded_at ?? null}
              gradedById={user.id}
            />
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Submission */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Submission</p>
              {submission && (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  currentGrade === 'complete' ? 'bg-teal-light text-teal-primary' :
                  currentGrade === 'incomplete' ? 'bg-red-50 text-red-500' :
                  submission.status === 'submitted' ? 'bg-teal-light text-teal-primary' :
                  'bg-yellow-50 text-yellow-600'
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
                </div>

                {/* History */}
                {submissionHistory && submissionHistory.length > 1 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                      All Submissions ({submissionHistory.length})
                    </p>
                    {submissionHistory.map((entry, i) => (
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
                        {i === 0 && <span className="text-muted-text shrink-0">(latest)</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-text italic">No submission yet.</p>
            )}
          </div>

          {/* Checklist */}
          {checklistItems && checklistItems.length > 0 && submission && (
            <InstructorChecklist
              items={checklistItems.map(i => ({ id: i.id, text: i.text, description: i.description ?? null }))}
              initialResponses={checklistResponses ?? []}
              submissionId={submission.id}
              gradedById={user.id}
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
            />
          )}

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
        </div>
      </main>
    </div>
  )
}

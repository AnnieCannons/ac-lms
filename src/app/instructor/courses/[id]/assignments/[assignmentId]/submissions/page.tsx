import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

type SubmissionStatus = 'draft' | 'submitted' | 'graded'
type SubmissionType = 'text' | 'link' | 'file'

function StatusBadge({ status }: { status: SubmissionStatus | null }) {
  if (status === 'submitted') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary shrink-0">
        Turned in
      </span>
    )
  }
  if (status === 'graded') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-primary shrink-0">
        Graded
      </span>
    )
  }
  if (status === 'draft') {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-600 shrink-0">
        Draft
      </span>
    )
  }
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">
      Not submitted
    </span>
  )
}

function SubmissionContent({ type, content }: { type: SubmissionType; content: string | null }) {
  if (!content) return <span className="text-muted-text italic">No content</span>
  if (type === 'link' || type === 'file') {
    return (
      <a
        href={content}
        target="_blank"
        rel="noopener noreferrer"
        className="text-teal-primary underline break-all"
      >
        {content}
      </a>
    )
  }
  return <span className="text-dark-text line-clamp-2">{content}</span>
}

export default async function InstructorSubmissionsPage({
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

  if (profile?.role === 'student') redirect('/student/courses')

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, due_date, module_day_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment) redirect(`/instructor/courses/${id}`)

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  // All enrolled students
  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('user_id, users(id, name)')
    .eq('course_id', id)
    .eq('role', 'student')

  // All submissions for this assignment
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, student_id, submission_type, content, status, submitted_at')
    .eq('assignment_id', assignmentId)

  // Full submission history for this assignment
  const { data: history } = await supabase
    .from('submission_history')
    .select('id, student_id, submission_type, content, submitted_at')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false })

  const submissionMap = new Map<string, typeof submissions extends (infer T)[] | null ? T : never>(
    (submissions ?? []).map(s => [s.student_id, s])
  )

  const historyByStudent = new Map<string, typeof history extends (infer T)[] | null ? T[] : never[]>()
  for (const entry of history ?? []) {
    const existing = historyByStudent.get(entry.student_id) ?? []
    existing.push(entry)
    historyByStudent.set(entry.student_id, existing)
  }

  const students = (enrollments ?? []).map(e => {
    const u = Array.isArray(e.users) ? e.users[0] : e.users
    return { id: e.user_id, name: (u as { name: string } | null)?.name ?? 'Unknown' }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const turnedInCount = students.filter(s => {
    const sub = submissionMap.get(s.id)
    return sub?.status === 'submitted' || sub?.status === 'graded'
  }).length

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

      <main className="max-w-4xl mx-auto px-8 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">{course?.name}</Link>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium truncate max-w-[300px]">{assignment.title}</span>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">Submissions</span>
        </div>

        <h1 className="text-2xl font-bold text-dark-text mb-1">Submissions</h1>
        <p className="text-muted-text text-sm mb-2 truncate">{assignment.title}</p>
        {assignment.due_date && (
          <p className="text-xs text-muted-text mb-2">
            Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}
        <p className="text-xs text-muted-text mb-8">
          {students.length} enrolled · {turnedInCount} turned in · {students.length - turnedInCount} not submitted
        </p>

        {students.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No students enrolled.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border border border-border rounded-2xl overflow-hidden">
            {students.map(student => {
              const sub = submissionMap.get(student.id)
              const studentHistory = historyByStudent.get(student.id) ?? []

              return (
                <div key={student.id} className="bg-surface px-6 py-5">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <span className="text-sm font-semibold text-dark-text">{student.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {studentHistory.length > 0 && (
                        <span className="text-xs text-muted-text">
                          {studentHistory.length} submission{studentHistory.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <StatusBadge status={sub?.status as SubmissionStatus | null ?? null} />
                    </div>
                  </div>

                  {studentHistory.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {studentHistory.map((entry, i) => (
                        <div key={entry.id} className="flex items-start gap-3 text-xs bg-background rounded-lg px-3 py-2">
                          <span className="text-muted-text shrink-0 w-36">
                            {new Date(entry.submitted_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: 'numeric', minute: '2-digit',
                            })}
                          </span>
                          <div className="flex-1 min-w-0">
                            <SubmissionContent
                              type={entry.submission_type as SubmissionType}
                              content={entry.content}
                            />
                          </div>
                          {i === 0 && (
                            <span className="text-muted-text shrink-0">(latest)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : sub?.status === 'draft' && sub?.content ? (
                    <div className="flex items-start gap-3 text-xs bg-background rounded-lg px-3 py-2">
                      <span className="text-muted-text shrink-0 w-36">
                        {new Date(sub.submitted_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <SubmissionContent
                          type={sub.submission_type as SubmissionType}
                          content={sub.content}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-text italic">No submission yet.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

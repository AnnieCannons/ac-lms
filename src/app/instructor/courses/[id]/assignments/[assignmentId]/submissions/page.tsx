import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import SubmissionsList, { type StudentRow } from '@/components/ui/SubmissionsList'
import AnswerKeyField from '@/components/ui/AnswerKeyField'
import InstructorCourseNav from '@/components/ui/InstructorCourseNav'

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

  // Use service role for cross-user queries (bypasses RLS)
  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect(`/instructor/courses/${id}`) }

  const { data: assignment } = await admin
    .from('assignments')
    .select('id, title, due_date, answer_key_url')
    .eq('id', assignmentId)
    .single()

  if (!assignment) redirect(`/instructor/courses/${id}`)

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, users(id, name)')
    .eq('course_id', id)
    .eq('role', 'student')

  const { data: submissions } = await admin
    .from('submissions')
    .select('id, student_id, submission_type, content, status, grade, submitted_at')
    .eq('assignment_id', assignmentId)

  const { data: history } = await admin
    .from('submission_history')
    .select('id, student_id, submitted_at')
    .eq('assignment_id', assignmentId)

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

  const turnedInCount = students.filter(s =>
    s.submission?.status === 'submitted' || s.submission?.status === 'graded'
  ).length
  const gradedCount = students.filter(s => s.submission?.status === 'graded').length
  const needsGradingCount = students.filter(s => s.submission?.status === 'submitted').length

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/instructor/courses" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← All Courses
          </Link>
          <span className="text-sm text-gray-500">
            {profile?.name} · <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-border min-h-[calc(100vh-65px)] py-8 px-3">
          <InstructorCourseNav courseId={id} courseName={course?.name ?? ''} />
        </aside>

        <main className="flex-1 min-w-0 max-w-4xl mx-auto px-8 py-12">
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

        <h1 className="text-2xl font-bold text-dark-text mb-1">{assignment.title}</h1>
        {assignment.due_date && (
          <p className="text-xs text-muted-text mt-1">
            Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}
        <AnswerKeyField assignmentId={assignmentId} initialUrl={assignment.answer_key_url ?? null} />

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
            students={students}
            courseId={id}
            assignmentId={assignmentId}
          />
        )}
        </main>
      </div>
    </div>
  )
}

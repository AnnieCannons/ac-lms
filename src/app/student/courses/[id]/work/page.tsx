import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

function getCurrentWeek(startDate: string | null): number | null {
  if (!startDate) return null
  const start = new Date(startDate)
  const today = new Date()
  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return null
  return Math.floor(Math.floor(diffMs / (1000 * 60 * 60 * 24)) / 7) + 1
}

type SubmissionStatus = 'draft' | 'submitted' | 'graded'

function StatusBadge({ status, isLate }: { status: SubmissionStatus | null; isLate: boolean }) {
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
  if (isLate) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500 shrink-0">
        Late
      </span>
    )
  }
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">
      Not started
    </span>
  )
}

export default async function MyWorkPage({
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

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    redirect(`/instructor/courses/${id}`)
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .eq('role', 'student')
    .maybeSingle()

  if (!enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, start_date')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, week_number, order, module_days(id, assignments(id, title, due_date))')
    .eq('course_id', id)
    .order('order', { ascending: true })

  const { data: submissions } = await supabase
    .from('submissions')
    .select('assignment_id, status')
    .eq('student_id', user.id)

  const submissionMap = new Map<string, SubmissionStatus>(
    (submissions ?? []).map(s => [s.assignment_id, s.status as SubmissionStatus])
  )

  const now = new Date()
  const currentWeek = getCurrentWeek(course.start_date)

  // Flatten assignments per module, skip modules with none
  type AssignmentRow = {
    id: string
    title: string
    due_date: string | null
    status: SubmissionStatus | null
    isLate: boolean
  }
  type ModuleRow = {
    id: string
    title: string
    week_number: number | null
    isCurrentWeek: boolean
    assignments: AssignmentRow[]
  }

  const moduleRows: ModuleRow[] = (modules ?? [])
    .map(module => {
      const allAssignments = (module.module_days ?? []).flatMap(
        (day: { id: string; assignments?: { id: string; title: string; due_date: string | null }[] }) =>
          day.assignments ?? []
      )
      const sorted = allAssignments.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
      return {
        id: module.id,
        title: module.title,
        week_number: module.week_number,
        isCurrentWeek: currentWeek !== null && module.week_number === currentWeek,
        assignments: sorted.map(a => {
          const status = submissionMap.get(a.id) ?? null
          const isLate = !status && !!a.due_date && new Date(a.due_date) < now
          return { id: a.id, title: a.title, due_date: a.due_date, status, isLate }
        }),
      }
    })
    .filter(m => m.assignments.length > 0)

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

      <main className="max-w-4xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← My Courses
            </Link>
            <span className="text-border">/</span>
            <Link href={`/student/courses/${id}`} className="text-muted-text hover:text-teal-primary text-sm">
              {course.name}
            </Link>
            <span className="text-border">/</span>
            <h2 className="text-2xl font-bold text-dark-text">My Work</h2>
          </div>
          <Link
            href={`/student/courses/${id}`}
            className="text-sm text-teal-primary font-medium hover:underline shrink-0"
          >
            Course Overview →
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <p className="text-muted-text text-sm">{course.name}</p>
          {currentWeek && (
            <span className="bg-teal-light text-teal-primary text-xs font-semibold px-3 py-1 rounded-full">
              Week {currentWeek} this week
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <span className="text-xs text-muted-text">Status:</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text">Not started</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500">Late</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary">Turned in</span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-primary">Graded</span>
        </div>

        {moduleRows.length > 0 ? (
          <div className="flex flex-col gap-8">
            {moduleRows.map(module => (
              <div key={module.id}>
                {/* Module header */}
                <div className={`flex items-center gap-3 mb-3 pb-2 border-b ${module.isCurrentWeek ? 'border-teal-primary' : 'border-border'}`}>
                  <h3 className="font-semibold text-dark-text">{module.title}</h3>
                  {module.week_number && (
                    <span className="text-xs text-muted-text">Week {module.week_number}</span>
                  )}
                  {module.isCurrentWeek && (
                    <span className="bg-teal-light text-teal-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                      Current Week
                    </span>
                  )}
                </div>

                {/* Assignments */}
                <div className="flex flex-col gap-2">
                  {module.assignments.map(assignment => (
                    <Link
                      key={assignment.id}
                      href={`/student/courses/${id}/assignments/${assignment.id}`}
                      className="flex items-center justify-between bg-surface rounded-xl border border-border px-4 py-3 hover:border-teal-primary transition-colors gap-4"
                    >
                      <span className={`text-sm font-medium flex-1 min-w-0 truncate ${assignment.isLate ? 'text-red-500' : 'text-dark-text'}`}>
                        {assignment.title}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        {assignment.due_date && (
                          <span className={`text-xs ${assignment.isLate && !assignment.status ? 'text-red-400' : 'text-muted-text'}`}>
                            Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric',
                            })}
                          </span>
                        )}
                        <StatusBadge status={assignment.status} isLate={assignment.isLate} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No assignments available yet.</p>
          </div>
        )}
      </main>
    </div>
  )
}

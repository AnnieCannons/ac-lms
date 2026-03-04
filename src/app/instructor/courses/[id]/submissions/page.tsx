import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function CourseSubmissionsPage({
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

  if (profile?.role === 'student') redirect('/student/courses')

  const admin = createServiceSupabaseClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  // All modules → days → assignments for this course
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, week_number, order, module_days(id, day_name, order, assignments(id, title, due_date))')
    .eq('course_id', id)
    .order('order', { ascending: true })

  // Flatten to assignment list with module context
  type AssignmentMeta = {
    id: string
    title: string
    due_date: string | null
    moduleTitle: string
    weekNumber: number | null
  }

  const assignments: AssignmentMeta[] = (modules ?? []).flatMap(m =>
    (m.module_days ?? []).flatMap(d =>
      (d.assignments ?? []).map(a => ({
        id: a.id,
        title: a.title,
        due_date: a.due_date,
        moduleTitle: m.title,
        weekNumber: m.week_number,
      }))
    )
  )

  // All submissions for this course in one query
  const assignmentIds = assignments.map(a => a.id)
  const { data: allSubmissions } = assignmentIds.length
    ? await admin
        .from('submissions')
        .select('id, assignment_id, student_id, status, grade, submitted_at')
        .in('assignment_id', assignmentIds)
    : { data: [] }

  // Student count
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', id)
    .eq('role', 'student')

  const totalStudents = enrollments?.length ?? 0

  // Build stats per assignment
  const statsByAssignment = new Map<string, {
    turnedIn: number
    needsGrading: number
    graded: number
    complete: number
    incomplete: number
  }>()

  for (const sub of allSubmissions ?? []) {
    const s = statsByAssignment.get(sub.assignment_id) ?? {
      turnedIn: 0, needsGrading: 0, graded: 0, complete: 0, incomplete: 0,
    }
    if (sub.status === 'submitted' || sub.status === 'graded') s.turnedIn++
    if (sub.status === 'submitted') s.needsGrading++
    if (sub.status === 'graded') {
      s.graded++
      if (sub.grade === 'complete') s.complete++
      if (sub.grade === 'incomplete') s.incomplete++
    }
    statsByAssignment.set(sub.assignment_id, s)
  }

  const totalNeedsGrading = [...statsByAssignment.values()].reduce((n, s) => n + s.needsGrading, 0)

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
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6">
          <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">{course.name}</Link>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">All Submissions</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-dark-text mb-1">All Submissions</h1>
            <p className="text-sm text-muted-text">{course.name} · {totalStudents} students enrolled</p>
          </div>
          {totalNeedsGrading > 0 && (
            <span className="text-sm font-semibold px-4 py-2 rounded-full bg-yellow-50 text-yellow-600">
              {totalNeedsGrading} need grading
            </span>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No assignments in this course yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(modules ?? []).map(m => {
              const moduleAssignments = assignments.filter(a => a.moduleTitle === m.title)
              if (moduleAssignments.length === 0) return null
              return (
                <div key={m.id}>
                  <p className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1 py-2">
                    {m.title}{m.week_number ? ` · Week ${m.week_number}` : ''}
                  </p>
                  <div className="flex flex-col divide-y divide-border border border-border rounded-2xl overflow-hidden">
                    {moduleAssignments.map(assignment => {
                      const stats = statsByAssignment.get(assignment.id)
                      const hasNeedsGrading = (stats?.needsGrading ?? 0) > 0

                      return (
                        <div key={assignment.id} className="bg-surface px-6 py-4 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-dark-text">{assignment.title}</span>
                              {hasNeedsGrading && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">
                                  {stats!.needsGrading} ungraded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-text flex-wrap">
                              {assignment.due_date && (
                                <span>
                                  Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                  })}
                                </span>
                              )}
                              {stats ? (
                                <>
                                  <span>{stats.turnedIn}/{totalStudents} turned in</span>
                                  {stats.complete > 0 && (
                                    <span className="text-teal-primary">{stats.complete} complete</span>
                                  )}
                                  {stats.incomplete > 0 && (
                                    <span className="text-red-500">{stats.incomplete} incomplete</span>
                                  )}
                                </>
                              ) : (
                                <span>0/{totalStudents} turned in</span>
                              )}
                            </div>
                          </div>
                          <Link
                            href={`/instructor/courses/${id}/assignments/${assignment.id}/submissions`}
                            className="shrink-0 text-xs font-semibold text-teal-primary hover:underline"
                          >
                            View →
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

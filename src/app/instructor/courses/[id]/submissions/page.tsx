import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import CourseGradesView from '@/components/ui/CourseGradesView'
import InstructorSidebar from '@/components/ui/InstructorSidebar'

export default async function CourseSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'student') redirect('/student/courses')

  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect('/instructor/courses') }

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  // All modules → days → assignments for this course
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, week_number, order, module_days(id, day_name, order, assignments!module_day_id(id, title, due_date))')
    .eq('course_id', id)
    .order('order', { ascending: true })

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

  const assignmentIds = assignments.map(a => a.id)
  const { data: allSubmissions } = assignmentIds.length
    ? await admin
        .from('submissions')
        .select('id, assignment_id, student_id, status, grade, submitted_at')
        .in('assignment_id', assignmentIds)
    : { data: [] }

  // Enrolled students with names
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, users(id, name)')
    .eq('course_id', id)
    .eq('role', 'student')

  const students = (enrollments ?? [])
    .map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return {
        id: e.user_id,
        name: (u as { name: string } | null)?.name ?? 'Unknown',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalStudents = students.length

  // Stats per assignment
  const statsMap = new Map<string, {
    turnedIn: number
    needsGrading: number
    complete: number
    incomplete: number
  }>()

  for (const sub of allSubmissions ?? []) {
    const s = statsMap.get(sub.assignment_id) ?? {
      turnedIn: 0, needsGrading: 0, complete: 0, incomplete: 0,
    }
    if (sub.status === 'submitted' || sub.status === 'graded') s.turnedIn++
    if (sub.status === 'submitted') s.needsGrading++
    if (sub.status === 'graded') {
      if (sub.grade === 'complete') s.complete++
      if (sub.grade === 'incomplete') s.incomplete++
    }
    statsMap.set(sub.assignment_id, s)
  }

  const statsByAssignment = Object.fromEntries(statsMap)
  const totalNeedsGrading = [...statsMap.values()].reduce((n, s) => n + s.needsGrading, 0)

  // Slim submissions for client component
  const submissionsForClient = (allSubmissions ?? []).map(s => ({
    id: s.id,
    assignment_id: s.assignment_id,
    student_id: s.student_id,
    status: s.status,
    grade: s.grade,
  }))

  const modulesForClient = (modules ?? []).map(m => ({
    id: m.id,
    title: m.title,
    week_number: m.week_number,
  }))

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main className="max-w-4xl mx-auto px-8 py-10">
            <div className="flex items-center justify-between gap-3 mb-6">
              <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← Courses
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Grades</h1>
              <p className="text-sm text-muted-text">{course.name} · {totalStudents} students enrolled</p>
            </div>

            <CourseGradesView
              courseId={id}
              instructorId={user.id}
              initialTab={tab === 'students' ? 'students' : 'assignments'}
              modules={modulesForClient}
              assignments={assignments}
              students={students}
              statsByAssignment={statsByAssignment}
              submissions={submissionsForClient}
              totalStudents={totalStudents}
              totalNeedsGrading={totalNeedsGrading}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

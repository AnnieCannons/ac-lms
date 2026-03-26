import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import GradebookGrid from '@/components/ui/GradebookGrid'
import type { GradebookAssignment, GradebookModule, GradebookStudent, GradebookSubmission } from '@/components/ui/GradebookGrid'

export default async function GradebookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile, isTa } = await getInstructorOrTaAccess(id)

  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect('/instructor/courses') }

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  // Modules → days → published assignments
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, week_number, order, module_days(id, day_name, order, assignments!module_day_id(id, title, due_date, published))')
    .eq('course_id', id)
    .order('order', { ascending: true })

  const modulesForClient: GradebookModule[] = (modules ?? []).map(m => ({
    id: m.id,
    title: m.title,
    week_number: m.week_number,
  }))

  const assignments: GradebookAssignment[] = (modules ?? []).flatMap(m =>
    (m.module_days ?? []).flatMap(d =>
      (d.assignments ?? [])
        .filter(a => a.published)
        .map(a => ({
          id: a.id,
          title: a.title,
          due_date: a.due_date,
          moduleId: m.id,
          moduleTitle: m.title,
          weekNumber: m.week_number,
        }))
    )
  )

  const assignmentIds = assignments.map(a => a.id)

  // Grading group data for "My Grading Group" filter
  const [{ data: myGroupRows }, { data: allWeekRows }] = await Promise.all([
    admin.from('grading_groups').select('student_id, module_id').eq('course_id', id).eq('grader_id', user.id),
    admin.from('grading_groups').select('module_id').eq('course_id', id).not('module_id', 'is', null),
  ])

  const myGroupCourseLevel: string[] = (myGroupRows ?? [])
    .filter(r => !r.module_id)
    .map(r => r.student_id)

  const myGroupByModule: Record<string, string[]> = {}
  for (const r of myGroupRows ?? []) {
    if (r.module_id) {
      myGroupByModule[r.module_id] ??= []
      myGroupByModule[r.module_id].push(r.student_id)
    }
  }

  const modulesWithWeeklyGroups = [...new Set(
    (allWeekRows ?? []).map(r => r.module_id).filter(Boolean) as string[]
  )]

  const hasMyGroup = myGroupCourseLevel.length > 0 || Object.keys(myGroupByModule).length > 0

  const [enrollmentsResult, submissionsResult] = await Promise.all([
    admin
      .from('course_enrollments')
      .select('user_id, users(id, name)')
      .eq('course_id', id)
      .eq('role', 'student'),
    assignmentIds.length
      ? admin
          .from('submissions')
          .select('assignment_id, student_id, status, grade')
          .in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [] }),
  ])

  const students: GradebookStudent[] = (enrollmentsResult.data ?? [])
    .map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return {
        id: e.user_id,
        name: (u as { name: string } | null)?.name ?? 'Unknown',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const submissions: GradebookSubmission[] = (submissionsResult.data ?? []).map(s => ({
    assignment_id: s.assignment_id,
    student_id: s.student_id,
    status: s.status,
    grade: s.grade,
  }))

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        isTa={isTa}
        breadcrumbs={[
          { label: 'Courses', href: '/instructor/courses' },
          { label: course.name, href: `/instructor/courses/${id}` },
          { label: 'Gradebook' },
        ]}
      />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0 overflow-hidden">
          <main className="px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Gradebook</h1>
              <p className="text-sm text-muted-text">
                {course.name} · {students.length} students · {assignments.length} published assignments
              </p>
            </div>

            <GradebookGrid
              courseId={id}
              students={students}
              modules={modulesForClient}
              assignments={assignments}
              submissions={submissions}
              myGroupCourseLevel={myGroupCourseLevel}
              myGroupByModule={myGroupByModule}
              modulesWithWeeklyGroups={modulesWithWeeklyGroups}
              hasMyGroup={hasMyGroup}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

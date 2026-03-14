import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import GradingGroupsManager from '@/components/ui/GradingGroupsManager'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'

export default async function GradingGroupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile, isTa } = await getInstructorOrTaAccess(id)
  if (isTa) redirect(`/instructor/courses/${id}`)

  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect('/instructor/courses') }

  const { data: course } = await admin.from('courses').select('id, name').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  // Students
  const { data: studentEnrollments } = await admin
    .from('course_enrollments').select('user_id').eq('course_id', id).eq('role', 'student')
  const studentIds = studentEnrollments?.map(e => e.user_id) ?? []
  const { data: students } = studentIds.length
    ? await admin.from('users').select('id, name, email').in('id', studentIds).order('name')
    : { data: [] }

  // Graders: instructors + TAs assigned to this course
  const { data: graderEnrollments } = await admin
    .from('course_enrollments').select('user_id, role').eq('course_id', id).in('role', ['instructor', 'ta'])
  const graderIds = graderEnrollments?.map(e => e.user_id) ?? []
  const { data: graderUsers } = graderIds.length
    ? await admin.from('users').select('id, name').in('id', graderIds).order('name')
    : { data: [] }
  const graders = (graderUsers ?? []).map(u => ({
    ...u,
    type: (graderEnrollments?.find(e => e.user_id === u.id)?.role ?? 'ta') as 'instructor' | 'ta',
  }))

  // Student grader assignments
  const { data: groups } = await admin
    .from('grading_groups').select('student_id, grader_id').eq('course_id', id)
  const groupMap = Object.fromEntries((groups ?? []).map(g => [g.student_id, g.grader_id]))

  // Assignments for this course (via modules → days → assignments)
  const { data: moduleRows } = await admin.from('modules').select('id').eq('course_id', id).is('deleted_at', null)
  const moduleIds = moduleRows?.map(m => m.id) ?? []
  const { data: dayRows } = moduleIds.length
    ? await admin.from('module_days').select('id').in('module_id', moduleIds).is('deleted_at', null)
    : { data: [] }
  const dayIds = dayRows?.map(d => d.id) ?? []
  const { data: assignmentsData } = dayIds.length
    ? await admin.from('assignments').select('id, title, grader_id').in('module_day_id', dayIds).is('deleted_at', null).order('title')
    : { data: [] }

  const assignments = (assignmentsData ?? []).map(a => ({ id: a.id, title: a.title }))
  const assignmentGraderMap = Object.fromEntries(
    (assignmentsData ?? []).map(a => [a.id, (a.grader_id as string | null) ?? null])
  )

  // Per-grader ungraded count (respects assignment overrides and student groups)
  const allAssignmentIds = (assignmentsData ?? []).map(a => a.id)
  const { data: ungradedSubs } = allAssignmentIds.length
    ? await admin.from('submissions').select('assignment_id, student_id')
        .in('assignment_id', allAssignmentIds).eq('status', 'submitted')
    : { data: [] }
  const graderUngradedCount: Record<string, number> = {}
  for (const sub of ungradedSubs ?? []) {
    const override = assignmentGraderMap[sub.assignment_id] ?? null
    const graderId = override !== null ? override : (groupMap[sub.student_id] ?? null)
    if (graderId) {
      graderUngradedCount[graderId] = (graderUngradedCount[graderId] ?? 0) + 1
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} />
      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-6 md:p-8 focus:outline-none">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-dark-text">Grading Groups</h1>
              <p className="text-sm text-muted-text mt-1">
                Assign students to graders. For specific assignments, you can override the student's default grader.
              </p>
            </div>

            {graders.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-border p-8 text-center">
                <p className="text-muted-text font-medium mb-1">No graders assigned to this course yet.</p>
                <p className="text-sm text-muted-text">
                  Go to{' '}
                  <Link href={`/instructor/courses/${id}/users`} className="text-teal-primary hover:underline">
                    Users
                  </Link>
                  {' '}→ Instructors section → click <strong>+ course</strong> to assign yourself,
                  then enroll any TAs via Add People.
                </p>
              </div>
            ) : (
              <GradingGroupsManager
                courseId={id}
                students={students ?? []}
                graders={graders}
                groupMap={groupMap}
                assignments={assignments}
                assignmentGraderMap={assignmentGraderMap}
                graderUngradedCount={graderUngradedCount}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

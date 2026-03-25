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

  // Modules (ordered): published only, no career/level_up category
  const { data: modulesWithDays } = await admin
    .from('modules')
    .select('id, title, order, category, module_days(id, deleted_at, assignments!module_day_id(id, title, grader_id, deleted_at, published))')
    .eq('course_id', id)
    .eq('published', true)
    .is('deleted_at', null)
    .order('order')

  // Build assignmentModuleMap: assignmentId → moduleId
  // Only include published assignments from non-career modules
  type RawAssignment = { id: string; title: string; grader_id: string | null; deleted_at: string | null; published: boolean }
  type RawDay = { id: string; deleted_at: string | null; assignments?: RawAssignment[] }
  type RawModule = { id: string; title: string; order: number; category: string | null; module_days?: RawDay[] }

  const assignmentModuleMap = new Map<string, string>()
  const moduleIdsWithAssignments = new Set<string>()
  for (const m of (modulesWithDays ?? []) as RawModule[]) {
    if (m.category === 'career' || m.category === 'level_up') continue
    for (const day of m.module_days ?? []) {
      if (!day.deleted_at) {
        for (const a of day.assignments ?? []) {
          if (!a.deleted_at && a.published !== false) {
            assignmentModuleMap.set(a.id, m.id)
            moduleIdsWithAssignments.add(m.id)
          }
        }
      }
    }
  }

  // Only modules with published assignments, excluding career/level_up
  const modules = ((modulesWithDays ?? []) as RawModule[])
    .filter(m => moduleIdsWithAssignments.has(m.id))
    .map(m => ({ id: m.id, title: m.title, order: m.order }))

  const assignmentsData = ((modulesWithDays ?? []) as RawModule[])
    .filter(m => m.category !== 'career' && m.category !== 'level_up')
    .flatMap(m =>
      (m.module_days ?? [])
        .filter(d => !d.deleted_at)
        .flatMap(d => (d.assignments ?? []).filter(a => !a.deleted_at && a.published !== false))
    )
    .sort((a, b) => a.title.localeCompare(b.title))

  const assignments = assignmentsData.map(a => ({ id: a.id, title: a.title }))
  const assignmentGraderMap = Object.fromEntries(
    assignmentsData.map(a => [a.id, (a.grader_id as string | null) ?? null])
  )

  // Course-level groups (module_id IS NULL)
  const { data: courseGroups } = await admin
    .from('grading_groups')
    .select('student_id, grader_id')
    .eq('course_id', id)
    .is('module_id', null)
  const groupMap = Object.fromEntries((courseGroups ?? []).map(g => [g.student_id, g.grader_id]))

  // Week-specific groups (module_id IS NOT NULL)
  const { data: weeklyGroupRows } = await admin
    .from('grading_groups')
    .select('student_id, grader_id, module_id')
    .eq('course_id', id)
    .not('module_id', 'is', null)

  const weeklyRotationEnabled = (weeklyGroupRows?.length ?? 0) > 0

  // Build weeklyGroupMap: moduleId → studentId → graderId
  const weeklyGroupMap: Record<string, Record<string, string | null>> = {}
  for (const row of weeklyGroupRows ?? []) {
    if (!row.module_id) continue
    weeklyGroupMap[row.module_id] ??= {}
    weeklyGroupMap[row.module_id][row.student_id] = row.grader_id
  }

  // Ungraded submissions — compute per-grader and per-week counts
  const allAssignmentIds = assignmentsData.map(a => a.id)
  const { data: ungradedSubs } = allAssignmentIds.length
    ? await admin.from('submissions').select('assignment_id, student_id')
        .in('assignment_id', allAssignmentIds).eq('status', 'submitted')
    : { data: [] }

  const graderUngradedCount: Record<string, number> = {}
  const weeklyUngradedCount: Record<string, Record<string, number>> = {}

  for (const sub of ungradedSubs ?? []) {
    const override = assignmentGraderMap[sub.assignment_id] ?? null
    const moduleId = assignmentModuleMap.get(sub.assignment_id) ?? null

    let graderId: string | null
    if (override !== null) {
      graderId = override
    } else if (weeklyRotationEnabled && moduleId && weeklyGroupMap[moduleId]?.[sub.student_id] !== undefined) {
      graderId = weeklyGroupMap[moduleId][sub.student_id]
    } else {
      graderId = groupMap[sub.student_id] ?? null
    }

    if (graderId) {
      graderUngradedCount[graderId] = (graderUngradedCount[graderId] ?? 0) + 1
      if (moduleId && weeklyRotationEnabled) {
        weeklyUngradedCount[moduleId] ??= {}
        weeklyUngradedCount[moduleId][graderId] = (weeklyUngradedCount[moduleId][graderId] ?? 0) + 1
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${id}` }, { label: 'Grading Groups' }]} />
      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 p-6 md:p-8 focus:outline-none">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-dark-text">Grading Groups</h1>
              <p className="text-sm text-muted-text mt-1">
                Assign students to graders. For specific assignments, you can override the student&apos;s default grader.
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
                modules={modules}
                weeklyGroupMap={weeklyGroupMap}
                weeklyRotationEnabled={weeklyRotationEnabled}
                weeklyUngradedCount={weeklyUngradedCount}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

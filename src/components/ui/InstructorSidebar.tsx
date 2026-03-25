import ResizableSidebar from './ResizableSidebar'
import InstructorCourseNav from './InstructorCourseNav'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export default async function InstructorSidebar({ courseId, courseName }: { courseId: string; courseName: string }) {
  let needsGrading = 0
  let firstUngradedAssignmentId: string | null = null
  let myGroupNeedsGrading = 0
  let myGroupFirstAssignmentId: string | null = null
  let isTa = false

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('role')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .maybeSingle()
        isTa = enrollment?.role === 'ta'
      }
    }

    const admin = createServiceSupabaseClient()

    // Fetch modules with ordering so we can find the first ungraded assignment in order
    const { data: moduleData } = await admin
      .from('modules')
      .select('id, order, module_days(order, assignments!module_day_id(id, order))')
      .eq('course_id', courseId)

    type RawDay = { order: number; assignments: { id: string; order: number }[] }
    type RawModule = { id: string; order: number; module_days: RawDay[] }

    // Build assignmentModuleMap: assignmentId → moduleId
    const assignmentModuleMap = new Map<string, string>()
    for (const m of (moduleData as RawModule[] ?? [])) {
      for (const d of m.module_days ?? []) {
        for (const a of d.assignments ?? []) {
          assignmentModuleMap.set(a.id, m.id)
        }
      }
    }

    const orderedAssignmentIds = (moduleData as RawModule[] ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .flatMap(m =>
        (m.module_days ?? [])
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .flatMap(d =>
            (d.assignments ?? [])
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map(a => a.id)
          )
      )

    if (orderedAssignmentIds.length > 0) {
      const { data: enrolledStudents } = await admin
        .from('course_enrollments')
        .select('user_id')
        .eq('course_id', courseId)
        .eq('role', 'student')
      const enrolledStudentIds = (enrolledStudents ?? []).map(e => e.user_id)

      const { data: ungradedSubs } = await admin
        .from('submissions')
        .select('assignment_id, student_id')
        .in('assignment_id', orderedAssignmentIds)
        .eq('status', 'submitted')
        .in('student_id', enrolledStudentIds.length > 0 ? enrolledStudentIds : [''])

      needsGrading = ungradedSubs?.length ?? 0
      const ungradedSet = new Set(ungradedSubs?.map(s => s.assignment_id) ?? [])
      firstUngradedAssignmentId = orderedAssignmentIds.find(id => ungradedSet.has(id)) ?? null

      // Compute my-group stats (week-aware: uses module-specific groups when weekly rotation is enabled)
      if (user && ungradedSubs && ungradedSubs.length > 0) {
        const [{ data: myGroupRows }, { data: assignmentGraderRows }, { data: allWeekRows }] = await Promise.all([
          admin.from('grading_groups').select('student_id, module_id').eq('course_id', courseId).eq('grader_id', user.id),
          admin.from('assignments').select('id, grader_id').in('id', orderedAssignmentIds),
          admin.from('grading_groups').select('module_id').eq('course_id', courseId).not('module_id', 'is', null),
        ])

        // Separate my groups into anchor (course-level) and week-specific
        const myAnchorStudentIds = new Set<string>()
        const myWeekStudentIds = new Map<string, Set<string>>()
        for (const row of myGroupRows ?? []) {
          if (row.module_id) {
            if (!myWeekStudentIds.has(row.module_id)) myWeekStudentIds.set(row.module_id, new Set())
            myWeekStudentIds.get(row.module_id)!.add(row.student_id)
          } else {
            myAnchorStudentIds.add(row.student_id)
          }
        }
        // Which modules have ANY week-specific groups (not just mine)
        const modulesWithWeeklyGroups = new Set((allWeekRows ?? []).map(r => r.module_id).filter(Boolean) as string[])

        const assignmentGraderMap = new Map(
          (assignmentGraderRows ?? []).map(a => [a.id, (a.grader_id as string | null)])
        )
        const myGroupAssignmentIds = new Set<string>()
        for (const sub of ungradedSubs) {
          const override = assignmentGraderMap.get(sub.assignment_id)
          const moduleId = assignmentModuleMap.get(sub.assignment_id)
          let belongsToMe: boolean
          if (override !== undefined && override !== null) {
            belongsToMe = override === user.id
          } else if (moduleId && modulesWithWeeklyGroups.has(moduleId)) {
            belongsToMe = myWeekStudentIds.get(moduleId)?.has(sub.student_id) ?? false
          } else {
            belongsToMe = myAnchorStudentIds.has(sub.student_id)
          }
          if (belongsToMe) {
            myGroupAssignmentIds.add(sub.assignment_id)
            myGroupNeedsGrading++
          }
        }
        myGroupFirstAssignmentId = orderedAssignmentIds.find(id => myGroupAssignmentIds.has(id)) ?? null
      }
    }
  } catch {
    // Non-critical — badge and grader button degrade gracefully
  }

  return (
    <ResizableSidebar>
      <InstructorCourseNav
        courseId={courseId}
        courseName={courseName}
        needsGrading={needsGrading}
        firstUngradedAssignmentId={firstUngradedAssignmentId}
        myGroupNeedsGrading={myGroupNeedsGrading}
        myGroupFirstAssignmentId={myGroupFirstAssignmentId}
        isTa={isTa}
      />
    </ResizableSidebar>
  )
}

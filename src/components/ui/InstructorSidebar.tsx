import ResizableSidebar from './ResizableSidebar'
import InstructorCourseNav from './InstructorCourseNav'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export default async function InstructorSidebar({ courseId, courseName }: { courseId: string; courseName: string }) {
  let needsGrading = 0
  let firstUngradedAssignmentId: string | null = null
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
      .select('order, module_days(order, assignments!module_day_id(id, order))')
      .eq('course_id', courseId)

    type RawDay = { order: number; assignments: { id: string; order: number }[] }
    type RawModule = { order: number; module_days: RawDay[] }

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
      const { data: ungradedSubs } = await admin
        .from('submissions')
        .select('assignment_id')
        .in('assignment_id', orderedAssignmentIds)
        .eq('status', 'submitted')

      needsGrading = ungradedSubs?.length ?? 0
      const ungradedSet = new Set(ungradedSubs?.map(s => s.assignment_id) ?? [])
      firstUngradedAssignmentId = orderedAssignmentIds.find(id => ungradedSet.has(id)) ?? null
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
        isTa={isTa}
      />
    </ResizableSidebar>
  )
}

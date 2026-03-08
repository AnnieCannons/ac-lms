import ResizableSidebar from './ResizableSidebar'
import InstructorCourseNav from './InstructorCourseNav'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

export default async function InstructorSidebar({ courseId, courseName }: { courseId: string; courseName: string }) {
  let needsGrading = 0
  try {
    const admin = createServiceSupabaseClient()
    const { data: moduleData } = await admin
      .from('modules')
      .select('module_days(assignments!module_day_id(id))')
      .eq('course_id', courseId)

    type RawModule = { module_days: { assignments: { id: string }[] }[] }
    const assignmentIds = (moduleData as RawModule[] ?? []).flatMap(m =>
      (m.module_days ?? []).flatMap(d => (d.assignments ?? []).map(a => a.id))
    )

    if (assignmentIds.length > 0) {
      const { count } = await admin
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .in('assignment_id', assignmentIds)
        .eq('status', 'submitted')
      needsGrading = count ?? 0
    }
  } catch {
    // Non-critical — badge just won't show
  }

  return (
    <ResizableSidebar>
      <InstructorCourseNav courseId={courseId} courseName={courseName} needsGrading={needsGrading} />
    </ResizableSidebar>
  )
}

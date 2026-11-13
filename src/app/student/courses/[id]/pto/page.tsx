import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import YearlyScheduleSection from '@/components/ui/YearlyScheduleSection'
import StudentPageBanner from '@/components/ui/StudentPageBanner'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'

export default async function StudentPTOPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getStudentCourseViewer(id, { allowStaffTa: true })
  const { supabase } = viewer

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')
  if (!course.paid_learners) redirect(`/student/courses/${id}`)

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={viewer.viewerName} role={viewer.viewerRole} />
      <StudentPageBanner viewer={viewer} courseId={id} />

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={true} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">Paid Time Off</h1>
              <p className="text-sm text-muted-text mt-1">{course.name}</p>
            </div>
            <YearlyScheduleSection hideCohorts paidOnly />
          </main>
        </div>
      </div>
    </div>
  )
}

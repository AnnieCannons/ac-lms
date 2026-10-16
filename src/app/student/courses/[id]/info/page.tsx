import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import GeneralInfoSections from '@/components/ui/GeneralInfoSections'
import StudentPageBanner from '@/components/ui/StudentPageBanner'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'

export default async function GeneralInfoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const viewer = await getStudentCourseViewer(id)
  const { supabase } = viewer

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners, start_date')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: sections } = await supabase
    .from('course_sections')
    .select('id, title, content, order, type')
    .eq('course_id', id)
    .eq('published', true)
    .order('order', { ascending: true })

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={viewer.viewerName} role={viewer.viewerRole} />
      <StudentPageBanner viewer={viewer} courseId={id} />

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">General Info</h1>
              <p className="text-sm text-muted-text mt-1">{course.name}</p>
            </div>

            {sections && sections.length > 0 ? (
              <GeneralInfoSections sections={sections} courseStartDate={course.start_date ?? null} />
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No general information available yet.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

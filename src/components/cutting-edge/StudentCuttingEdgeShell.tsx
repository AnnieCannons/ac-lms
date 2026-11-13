import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import StudentPageBanner from '@/components/ui/StudentPageBanner'
import type { StudentCourseViewer } from '@/lib/student-course-viewer'

export default function StudentCuttingEdgeShell({
  viewer,
  course,
  children,
}: {
  viewer: StudentCourseViewer
  course: { id: string; name: string; paid_learners: boolean | null }
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={viewer.viewerName} role={viewer.viewerRole} />
      <StudentPageBanner viewer={viewer} courseId={course.id} />
      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={course.id} courseName={course.name} paidLearners={!!course.paid_learners} />
        </ResizableSidebar>
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 sm:px-8 py-10 focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

import type { StudentCourseViewer } from '@/lib/student-course-viewer'
import ImpersonateBanner from './ImpersonateBanner'
import StudentViewBanner from './StudentViewBanner'

/** "Viewing as <student>" while an admin views a student's pages, or the instructor's own preview banner. */
export default function StudentPageBanner({ viewer, courseId }: { viewer: StudentCourseViewer; courseId: string }) {
  if (viewer.impersonation) {
    return (
      <ImpersonateBanner
        studentName={viewer.impersonation.studentName}
        returnPath={`/instructor/courses/${courseId}/roster/${viewer.impersonation.userId}`}
      />
    )
  }
  if (viewer.preview) return <StudentViewBanner courseId={courseId} />
  return null
}

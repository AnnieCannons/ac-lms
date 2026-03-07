'use client'
import ResizableSidebar from './ResizableSidebar'
import InstructorCourseNav from './InstructorCourseNav'

export default function InstructorSidebar({ courseId, courseName }: { courseId: string; courseName: string }) {
  return (
    <ResizableSidebar>
      <InstructorCourseNav courseId={courseId} courseName={courseName} />
    </ResizableSidebar>
  )
}

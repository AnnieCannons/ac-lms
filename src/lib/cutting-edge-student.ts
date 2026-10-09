import { notFound, redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'
import { loadStudentEvents } from '@/lib/cutting-edge-server'

/** Access + data for the student Cutting Edge Talks pages. */
export async function getStudentCuttingEdge(courseId: string) {
  const viewer = await getStudentCourseViewer(courseId)
  const { data: course } = await viewer.supabase
    .from('courses').select('id, name, paid_learners').eq('id', courseId).single()
  if (!course) redirect('/student/courses')
  const now = new Date()
  // Preview has no student of its own; everyone else sees the viewed student's RSVPs.
  const items = await loadStudentEvents(createServiceSupabaseClient(), courseId, viewer.preview ? null : viewer.viewerId, now)
  // Nothing on these pages may write on anyone else's behalf.
  const canAct = !viewer.preview && !viewer.readOnly && viewer.enrollmentRole === 'student'
  return { viewer, course, items, now, canAct }
}

export async function getStudentCuttingEdgeEvent(courseId: string, eventId: string) {
  const ctx = await getStudentCuttingEdge(courseId)
  const item = ctx.items.find(i => i.event.id === eventId)
  if (!item) notFound()
  return { ...ctx, ...item }
}

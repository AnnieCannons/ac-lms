import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import RosterView from '@/components/ui/RosterView'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile, isTa } = await getInstructorOrTaAccess(id)
  const supabase = await createServerSupabaseClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  const admin = createServiceSupabaseClient()

  // All courses for tabs — TAs only see their own course
  const { data: allCourses } = isTa
    ? { data: null }
    : await admin.from('courses').select('id, name').order('created_at', { ascending: false })

  // Students and observers enrolled in current course
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, role, users(id, name, email)')
    .eq('course_id', id)
    .in('role', ['student', 'observer'])

  const studentIds = (enrollments ?? []).map(e => e.user_id)

  // Accommodations for those students
  const { data: accommodations } = studentIds.length > 0
    ? await admin
        .from('accommodations')
        .select('user_id, camera_off, camera_off_start, camera_off_end, notes')
        .in('user_id', studentIds)
    : { data: [] }

  // Auto-expire: if camera_off_end has passed, clear camera off
  // Use Pacific time so the icon lasts through the full local day (not UTC midnight)
  const nowPT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const todayPT = `${nowPT.getFullYear()}-${String(nowPT.getMonth() + 1).padStart(2, '0')}-${String(nowPT.getDate()).padStart(2, '0')}`
  const expiredIds = (accommodations ?? [])
    .filter(a => a.camera_off && a.camera_off_end && a.camera_off_end < todayPT)
    .map(a => a.user_id)

  if (expiredIds.length > 0) {
    await admin
      .from('accommodations')
      .update({ camera_off: false, camera_off_start: null, camera_off_end: null })
      .in('user_id', expiredIds)
    // Update local data to reflect expiry
    for (const a of accommodations ?? []) {
      if (expiredIds.includes(a.user_id)) {
        a.camera_off = false
        a.camera_off_start = null
        a.camera_off_end = null
      }
    }
  }

  const accommodationMap = Object.fromEntries(
    (accommodations ?? []).map(a => [a.user_id, {
      cameraOff: a.camera_off,
      cameraOffStart: a.camera_off_start ?? null,
      cameraOffEnd: a.camera_off_end ?? null,
      notes: a.notes ?? '',
    }])
  )

  const students = (enrollments ?? [])
    .map(e => {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      return {
        userId: e.user_id,
        name: u?.name ?? '',
        email: u?.email ?? '',
        accommodation: accommodationMap[e.user_id] ?? null,
        enrollmentRole: e.role as 'student' | 'observer',
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Current course first, then rest sorted by name (TAs only see their course)
  const otherCourses = isTa ? [] : (allCourses ?? []).filter(c => c.id !== id)
  const courses = [course, ...otherCourses]

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <h1 className="text-2xl font-bold text-dark-text mb-8">Roster</h1>
            <RosterView
              courses={courses}
              currentCourseId={id}
              students={students}
              readOnly={isTa}
            />
          </main>
        </div>
      </div>
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import AttendanceView from './AttendanceView'
import { fetchStudentAttendance, fetchStudentProfile, fetchAttendanceCourses } from '@/lib/airtable'

export const dynamic = 'force-dynamic'

export default async function StudentAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; course?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isInstructorOrAdmin = profile?.role === 'instructor' || profile?.role === 'admin'
  const { as: previewName, course: courseParam } = await searchParams

  if (isInstructorOrAdmin && !previewName) redirect('/instructor/attendance')
  if (!isInstructorOrAdmin && previewName) redirect('/student/attendance')

  const name = previewName ?? profile?.name ?? null

  if (!name) {
    return (
      <div className="min-h-screen bg-background">
        <StudentTopNav name={profile?.name} role={profile?.role} />
        <main className="max-w-4xl mx-auto px-4 py-10">
          <p className="text-muted-text">Could not load your profile. Please contact support.</p>
        </main>
      </div>
    )
  }

  let records = null
  let studentProfile = null
  let courses = null
  let airtableError = false

  try {
    // Fetch profile first to get the canonical name (handles case-insensitive URLs)
    // then use canonical name for attendance lookup to match formula field exactly
    ;[studentProfile, courses] = await Promise.all([
      fetchStudentProfile(name),
      fetchAttendanceCourses(),
    ])
    const canonicalName = studentProfile?.preferredName ?? name
    records = await fetchStudentAttendance(canonicalName)
  } catch (err) {
    console.error('Airtable fetch error:', err)
    airtableError = true
  }

  const Nav = isInstructorOrAdmin
    ? () => (
        <InstructorTopNav
          name={profile?.name}
          role={profile?.role}
          breadcrumbs={[
            { label: 'Attendance Portal', href: '/instructor/attendance' },
            { label: name },
          ]}
        />
      )
    : () => <StudentTopNav name={profile?.name} role={profile?.role} />

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      {isInstructorOrAdmin && (
        <div className="bg-teal-light border-b border-teal-primary/20 px-4 py-2 text-sm text-teal-primary text-center">
          Viewing attendance as <strong>{name}</strong>
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-10 focus:outline-none">
        {airtableError ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <p className="text-dark-text font-semibold mb-2">Attendance data unavailable</p>
            <p className="text-muted-text text-sm">
              Unable to load attendance records right now. Please try again later or contact support.
            </p>
          </div>
        ) : (
          <AttendanceView
            records={records ?? []}
            profile={studentProfile}
            courses={courses ?? []}
            defaultCourseName={isInstructorOrAdmin ? courseParam : undefined}
          />
        )}
      </main>
    </div>
  )
}

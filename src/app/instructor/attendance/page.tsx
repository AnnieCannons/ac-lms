import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorAttendanceView from './InstructorAttendanceView'
import { fetchActiveClasses } from '@/lib/airtable'

export const dynamic = 'force-dynamic'

export default async function InstructorAttendancePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isInstructorOrAdmin =
    profile?.role === 'instructor' || profile?.role === 'staff' || profile?.role === 'admin'

  if (!isInstructorOrAdmin) {
    const service = createServiceSupabaseClient()
    const { data: taEnrollment } = await service
      .from('course_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'ta')
      .limit(1)
      .maybeSingle()
    if (!taEnrollment) redirect('/unauthorized')
  }

  let classes: string[] = []
  let airtableError = false
  try {
    classes = await fetchActiveClasses()
  } catch (err) {
    console.error('fetchActiveClasses error:', err)
    airtableError = true
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        breadcrumbs={[{ label: 'Attendance Portal' }]}
      />
      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 py-8 sm:px-6 sm:py-10 focus:outline-none">
        {airtableError ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <p className="text-dark-text font-semibold mb-2">Attendance data unavailable</p>
            <p className="text-muted-text text-sm">
              Unable to connect to Airtable right now. Please try again later or check the server
              configuration.
            </p>
          </div>
        ) : (
          <InstructorAttendanceView initialClasses={classes} />
        )}
      </main>
    </div>
  )
}

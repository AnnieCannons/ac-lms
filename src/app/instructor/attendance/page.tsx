import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorAttendanceView from './InstructorAttendanceView'
import { fetchActiveClasses } from '@/lib/airtable'
import { getAttendanceAccess, filterClasses } from '@/lib/attendance-access'

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

  // Instructors/staff/admins see every class; TAs only their own courses' classes.
  const access = await getAttendanceAccess()
  if (!access) redirect('/unauthorized')

  let classes: string[] = []
  let airtableError = false
  try {
    classes = filterClasses(access, await fetchActiveClasses())
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

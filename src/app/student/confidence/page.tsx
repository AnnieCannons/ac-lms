import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ConfidenceTracker from '@/components/ui/ConfidenceTracker'

export const dynamic = 'force-dynamic'

export default async function StudentConfidencePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-10 focus:outline-none">
        <ConfidenceTracker userName={profile?.name ?? 'Student'} />
      </main>
    </div>
  )
}

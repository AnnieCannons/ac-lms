import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
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
        <div className="mb-6">
          <Link href="/student/courses" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
            ← My Courses
          </Link>
        </div>
        <ConfidenceTracker userName={profile?.name ?? 'Student'} />
      </main>
    </div>
  )
}

import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'
import { loadStudentTrend } from '@/lib/confidence-trend-data'
import StudentTopNav from '@/components/ui/StudentTopNav'
import SkillConfidenceView from '@/components/ui/SkillConfidenceView'

export const dynamic = 'force-dynamic'

export default async function SkillConfidencePage() {
  if (!isConfidenceRatingsEnabled()) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const service = createServiceSupabaseClient()
  const trends = await loadStudentTrend(supabase, service, user.id)
  const isStaff = profile?.role === 'admin' || profile?.role === 'instructor' || profile?.role === 'staff'

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-10 focus:outline-none">
        <h1 className="text-2xl font-extrabold text-dark-text">My Skill Confidence</h1>
        <p className="mt-1 mb-8 text-sm text-muted-text">
          How your confidence in each skill has changed across your assignments, with the goals you set along the way.
        </p>
        <SkillConfidenceView trends={trends} canEdit={!isStaff} />
      </main>
    </div>
  )
}

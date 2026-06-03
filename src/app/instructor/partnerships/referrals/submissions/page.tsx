import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import RatingSubmissionsView from '@/components/ui/RatingSubmissionsView'
import { listAllRatings } from '@/lib/partner-ratings-actions'

export default async function RatingSubmissionsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/instructor')

  const { ratings, error } = await listAllRatings()

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link
            href="/instructor/partnerships/referrals"
            className="text-sm text-muted-text hover:text-teal-primary transition-colors"
          >
            ← Student Referrals
          </Link>
          <h1 className="text-2xl font-bold text-dark-text mt-3">Rating Submissions</h1>
          <p className="text-sm text-muted-text mt-1">
            All partner ratings submitted by students and staff.
          </p>
        </div>

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <RatingSubmissionsView initialRatings={ratings} />
        )}
      </main>
    </div>
  )
}

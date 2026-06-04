import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentReferralRateForm from '@/components/ui/StudentReferralRateForm'

interface Props {
  params: Promise<{ referralId: string }>
}

export default async function RateReferralPage({ params }: Props) {
  const { referralId } = await params

  // Auth: verify logged-in student
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') redirect('/login')

  // Use service role to fetch referral + partner name (bypasses partner RLS)
  const service = createServiceSupabaseClient()

  const { data: referral, error: referralError } = await service
    .from('student_referrals')
    .select(`
      id, referral_date, service_category, student_user_id, partner_id,
      partners (name)
    `)
    .eq('id', referralId)
    .single()

  if (referralError || !referral) {
    return (
      <div className="min-h-screen bg-background">
        <StudentTopNav name={profile?.name} />
        <main className="max-w-lg mx-auto px-6 py-16 text-center">
          <p className="text-muted-text text-sm">This referral could not be found.</p>
        </main>
      </div>
    )
  }

  if (referral.student_user_id !== user.id) {
    return (
      <div className="min-h-screen bg-background">
        <StudentTopNav name={profile?.name} />
        <main className="max-w-lg mx-auto px-6 py-16 text-center">
          <p className="text-muted-text text-sm">You are not authorized to rate this referral.</p>
        </main>
      </div>
    )
  }

  // Check for existing student ratings on this referral
  const { data: existingRatings } = await service
    .from('partner_ratings')
    .select('id, service_category')
    .eq('referral_id', referralId)
    .eq('reviewer_type', 'student')

  const partnerName = Array.isArray(referral.partners)
    ? (referral.partners[0]?.name ?? 'this organization')
    : ((referral.partners as { name: string } | null)?.name ?? 'this organization')

  const alreadyRated = (existingRatings ?? []).length > 0

  if (alreadyRated) {
    return (
      <div className="min-h-screen bg-background">
        <StudentTopNav name={profile?.name} />
        <main className="max-w-lg mx-auto px-6 py-10">
          <div className="rounded-xl border border-border bg-surface px-6 py-10 text-center flex flex-col items-center gap-4">
            <div className="text-5xl text-yellow-400">★</div>
            <h2 className="text-lg font-bold text-dark-text">Thank you for your feedback!</h2>
            <p className="text-sm text-muted-text">
              Your rating for <span className="font-medium text-dark-text">{partnerName}</span> has been submitted. This helps us improve our partnerships.
            </p>
            <a
              href="/student/courses"
              className="mt-2 px-5 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
            >
              Back to my courses
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} />
      <main className="max-w-lg mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-dark-text">Rate your experience</h1>
          <p className="text-sm text-muted-text mt-1">
            {referral.service_category ? (
              <>
                You were referred to{' '}
                <span className="font-semibold text-dark-text">{partnerName}</span>{' '}
                for help with{' '}
                <span className="font-semibold text-dark-text">
                  {referral.service_category
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                    .join(' and ')}
                </span>.
              </>
            ) : (
              <>
                You were referred to{' '}
                <span className="font-semibold text-dark-text">{partnerName}</span>.
              </>
            )}
          </p>
          <p className="text-sm text-muted-text mt-2">
            Your ratings help us understand which organizations are most helpful so we can make better referrals for future students.
          </p>
          <p className="text-xs text-muted-text mt-2">
            Referral date:{' '}
            {new Date(referral.referral_date + 'T00:00:00').toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>

        <StudentReferralRateForm
          referralId={referralId}
          partnerId={referral.partner_id ?? ''}
          partnerName={partnerName}
          serviceCategories={
            referral.service_category
              ? referral.service_category.split(',').map((s: string) => s.trim()).filter(Boolean)
              : ['General']
          }
        />
      </main>
    </div>
  )
}

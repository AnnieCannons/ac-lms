import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentReferralRateForm from '@/components/ui/StudentReferralRateForm'

interface Props {
  params: Promise<{ referralId: string }>
}

export default async function RateReferralPage({ params }: Props) {
  const { referralId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') redirect('/login')

  // Load referral and verify it belongs to this student
  const { data: referral, error: referralError } = await supabase
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

  // Check if a student rating already exists for this referral
  const { data: existingRating } = await supabase
    .from('partner_ratings')
    .select('id')
    .eq('referral_id', referralId)
    .eq('reviewer_type', 'student')
    .maybeSingle()

  const partnerName = Array.isArray(referral.partners)
    ? (referral.partners[0]?.name ?? 'this organization')
    : ((referral.partners as { name: string } | null)?.name ?? 'this organization')

  if (existingRating) {
    return (
      <div className="min-h-screen bg-background">
        <StudentTopNav name={profile?.name} />
        <main className="max-w-lg mx-auto px-6 py-16 text-center flex flex-col items-center gap-4">
          <div className="text-4xl">★</div>
          <h1 className="text-xl font-bold text-dark-text">Thank you!</h1>
          <p className="text-muted-text text-sm">
            Your rating for <span className="font-medium text-dark-text">{partnerName}</span> has already been submitted. We appreciate your feedback.
          </p>
          <a
            href="/student/courses"
            className="mt-4 px-5 py-2 rounded-lg bg-teal-primary text-white text-sm font-medium hover:bg-teal-primary/90 transition-colors"
          >
            Back to my courses
          </a>
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
            You were referred to <span className="font-medium text-dark-text">{partnerName}</span>.
            {referral.service_category && (
              <> They helped with <span className="font-medium text-dark-text">{referral.service_category}</span>.</>
            )}
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
          serviceCategory={referral.service_category ?? 'General'}
        />
      </main>
    </div>
  )
}

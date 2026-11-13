import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { loadMyOpenCheckin } from '@/lib/hardware-checkin-server'
import { responseToInput } from '@/lib/hardware-checkin'
import StudentTopNav from '@/components/ui/StudentTopNav'
import CheckinForm from '@/components/hardware/CheckinForm'

/** The student's equipment check-in (linked from the bell and the My Courses banner). */
export default async function EquipmentCheckinPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()

  // Only the signed-in student's own check-in (id from auth).
  const open = await loadMyOpenCheckin(createServiceSupabaseClient(), user.id)
  const reviewed = open?.response && open.response.review_status !== 'pending'

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      <main id="main-content" tabIndex={-1} className="max-w-2xl mx-auto px-4 sm:px-8 py-10 focus:outline-none">
        <h1 className="text-2xl font-bold text-dark-text mb-1">Equipment check-in</h1>
        <p className="text-sm text-muted-text mb-6">
          Tell us which AnnieCannons equipment you have, so we can keep track of it and help if something goes wrong. It takes about 2 minutes.
        </p>
        {!open ? (
          <div className="bg-surface rounded-2xl border border-border p-5 text-sm text-dark-text">
            There&apos;s nothing to fill in right now. <Link href="/student/courses" className="text-teal-primary hover:underline">Back to My Courses</Link>
          </div>
        ) : reviewed ? (
          <div className="bg-surface rounded-2xl border border-border p-5 text-sm text-dark-text flex flex-col gap-2">
            <p><span aria-hidden="true">✓ </span>Thank you! We&apos;ve recorded your check-in.</p>
            <p className="text-muted-text">If something has changed, reach out to Catie.</p>
          </div>
        ) : (
          <CheckinForm surveyId={open.survey.id} initial={responseToInput(open.response)} alreadyAnswered={!!open.response} />
        )}
      </main>
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import MarkCompleteButton from '@/components/onboarding/MarkCompleteButton'
import { getOnboardingViewer } from '@/lib/onboarding-access'
import { finishOnboardingIfDone, loadStudentProgress } from '@/lib/onboarding-server'
import {
  ONBOARDING_STATUS_LABELS,
  onboardingFinishedKey,
  pacificShortDate,
  type OnboardingItem,
  type OnboardingItemStatus,
} from '@/lib/onboarding'
import { pacificToday } from '@/lib/hardware-reminders'
import { formatDueDate } from '@/lib/date-utils'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<OnboardingItemStatus, string> = {
  complete: 'bg-green-100 text-green-700 border-green-200',
  excused: 'bg-background text-muted-text border-border',
  needs_revision: 'badge-orange',
  turned_in: 'badge-amber',
  check_off: 'badge-amber',
  not_started: 'bg-background text-muted-text border-border',
}

function ItemRow({ item, courseId, studentId }: { item: OnboardingItem; courseId: string; studentId: string }) {
  const a = item.assignment
  const canMark = item.status === 'turned_in' || item.status === 'check_off'
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${item.counts ? '' : 'opacity-70'}`}>
      <div className="min-w-0 flex-1 basis-60">
        <Link
          href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions/${studentId}`}
          className="text-sm font-semibold text-dark-text hover:text-teal-primary"
        >
          {a.title}
        </Link>
        <p className="text-xs text-muted-text">
          {item.dueDate ? `Due ${formatDueDate(item.dueDate)}` : 'No due date'}
          {item.overdue && <span className="font-semibold text-red-600"> · overdue</span>}
          {!item.counts && ' · doesn’t count toward finishing'}
          {a.submission_required === false && ' · no submission (staff check-off)'}
        </p>
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_STYLES[item.status]}`}>
        {ONBOARDING_STATUS_LABELS[item.status]}
      </span>
      <div className="w-32 flex justify-end">
        {canMark && (
          <MarkCompleteButton
            courseId={courseId}
            assignmentId={a.id}
            studentId={studentId}
            submissionId={item.submissionId}
            checkOff={item.status === 'check_off'}
            title={a.title}
          />
        )}
      </div>
    </li>
  )
}

export default async function OnboardingStudentPage({ params }: { params: Promise<{ courseId: string; userId: string }> }) {
  const viewer = await getOnboardingViewer()
  const { courseId, userId } = await params
  const admin = createServiceSupabaseClient()

  const [{ data: course }, { data: student }, { data: enrollment }] = await Promise.all([
    admin.from('courses').select('id, name, is_enrollment_readiness').eq('id', courseId).maybeSingle(),
    admin.from('users').select('id, name, email').eq('id', userId).maybeSingle(),
    admin.from('course_enrollments').select('role').eq('course_id', courseId).eq('user_id', userId).maybeSingle(),
  ])
  if (!course?.is_enrollment_readiness || !student || enrollment?.role !== 'student') notFound()

  const today = pacificToday()
  let progress = await loadStudentProgress(admin, courseId, userId, today)
  if (progress.finished) {
    // Finished without the finish steps having run (e.g. the last one was excused): run them now.
    const { data: claim } = await admin.from('hardware_alerts_sent').select('key').eq('key', onboardingFinishedKey(courseId, userId)).maybeSingle()
    if (!claim) {
      await finishOnboardingIfDone(admin, courseId, userId, null, progress).catch(e => console.error('onboarding: finish failed', e))
      progress = await loadStudentProgress(admin, courseId, userId, today)
    }
  }
  const { data: completion } = await admin.from('course_completions').select('completed_at').eq('course_id', courseId).eq('user_id', userId).maybeSingle()
  // Finishing sticks once it happened (see loadStudentOnboarding)
  const finished = progress.finished || !!completion?.completed_at

  const counted = progress.items.filter(i => i.counts)
  const notCounted = progress.items.filter(i => !i.counts)
  const name = student.name ?? student.email

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={viewer.name}
        role={viewer.role}
        breadcrumbs={[
          { label: 'Dashboard', href: '/instructor' },
          { label: 'New Student Onboarding', href: `/instructor/onboarding?course=${courseId}` },
          { label: name },
        ]}
      />
      <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 sm:px-8 py-10 focus:outline-none flex flex-col gap-6">
        <div>
          <Link href={`/instructor/onboarding?course=${courseId}`} className="text-sm text-muted-text hover:text-teal-primary">← {course.name}</Link>
          <h1 className="text-2xl font-bold text-dark-text mt-2">{name}</h1>
          <p className="text-sm text-muted-text">{student.email}</p>
        </div>

        <section className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-dark-text">{progress.done} of {progress.total} complete</p>
            {finished
              ? <p className="text-sm font-semibold text-green-700">✓ Finished{completion?.completed_at ? ` ${pacificShortDate(completion.completed_at, true)}` : ''}</p>
              : <p className="text-sm text-muted-text">{[
                  progress.toMark > 0 && `${progress.toMark} to mark Complete`,
                  progress.needsRevision > 0 && `${progress.needsRevision} needs revision`,
                  progress.overdue > 0 && `${progress.overdue} overdue`,
                ].filter(Boolean).join(' · ') || 'In progress'}</p>}
          </div>
          <p className="mt-2 text-xs text-muted-text">
            Everything that counts has to be marked Complete. Turned-in work and staff check-offs can be marked right here;
            open an assignment to read what they submitted first.
          </p>
        </section>

        <section aria-labelledby="counted-heading">
          <h2 id="counted-heading" className="text-xs font-bold uppercase tracking-wide text-muted-text mb-2">Counts toward finishing</h2>
          {counted.length === 0 ? (
            <p className="bg-surface rounded-2xl border border-border p-5 text-sm text-muted-text">No published assignments count toward finishing yet.</p>
          ) : (
            <ul className="bg-surface rounded-2xl border border-border divide-y divide-border">
              {counted.map(item => <ItemRow key={item.assignment.id} item={item} courseId={courseId} studentId={userId} />)}
            </ul>
          )}
        </section>

        {notCounted.length > 0 && (
          <section aria-labelledby="other-heading">
            <h2 id="other-heading" className="text-xs font-bold uppercase tracking-wide text-muted-text mb-2">Doesn&apos;t count toward finishing</h2>
            <ul className="bg-surface rounded-2xl border border-border divide-y divide-border">
              {notCounted.map(item => <ItemRow key={item.assignment.id} item={item} courseId={courseId} studentId={userId} />)}
            </ul>
          </section>
        )}

        <p className="text-sm">
          <Link href={`/instructor/hardware/students/${userId}`} className="font-semibold text-teal-primary hover:underline">Hardware page →</Link>
        </p>
      </main>
    </div>
  )
}

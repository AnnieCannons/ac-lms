import Link from 'next/link'
import { ONBOARDING_PRACTICE_LINKS } from '@/lib/onboarding'

/**
 * Top of an Enrollment Readiness course's outline: how far the student has got, and once
 * every counted assignment is marked Complete, a congratulations card with places to start
 * practicing.
 */
export default function OnboardingProgressCard({
  courseId,
  done,
  total,
  finished,
  waitingOnStaff,
  needsRevision,
  equipmentToShip,
}: {
  courseId: string
  done: number
  total: number
  finished: boolean
  /** Turned in (or a staff check-off) and not marked yet */
  waitingOnStaff: number
  needsRevision: number
  /** What we'll ship them, in words ("laptop", "laptop and hotspot"), or null if nothing */
  equipmentToShip: string | null
}) {
  if (finished) {
    return (
      <section aria-labelledby="onboarding-done-heading" className="mb-8 rounded-2xl border border-teal-primary/30 bg-teal-light p-6">
        <h2 id="onboarding-done-heading" className="text-lg font-bold text-dark-text">
          <span aria-hidden="true">🎉 </span>Congratulations, you finished Enrollment Readiness!
        </h2>
        <p className="mt-2 text-sm text-dark-text">
          We are so excited for you to start this journey with us.
        </p>
        <p className="mt-3 text-sm text-dark-text">
          We&apos;ll start with <strong>HTML in the third week of class</strong>. If you&apos;d like to start practicing now,
          try Codecademy&apos;s HTML course. CSS and JavaScript come after HTML, and you&apos;re welcome to explore those too.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {ONBOARDING_PRACTICE_LINKS.map(link => (
            <li key={link.url}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-4 py-2 text-sm font-semibold text-teal-primary hover:border-teal-primary transition-colors"
              >
                {link.title} on Codecademy<span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        {equipmentToShip && (
          <p className="mt-4 text-sm text-muted-text">
            Watch <Link href={`/student/courses/${courseId}/equipment`} className="font-semibold text-teal-primary hover:underline">My Equipment</Link> for
            the tracking number once we ship your {equipmentToShip}.
          </p>
        )}
      </section>
    )
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const notes = [
    waitingOnStaff > 0 && `${waitingOnStaff} waiting for us to review`,
    needsRevision > 0 && `${needsRevision} ${needsRevision === 1 ? 'needs' : 'need'} revision`,
  ].filter(Boolean)

  return (
    <section aria-labelledby="onboarding-progress-heading" className="mb-8 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="onboarding-progress-heading" className="text-sm font-bold text-dark-text">Your Enrollment Readiness progress</h2>
        <p className="text-sm font-semibold text-dark-text">{done} of {total} complete</p>
      </div>
      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-border/40"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} assignments complete`}
      >
        <div className="h-full rounded-full bg-teal-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      {notes.length > 0 && <p className="mt-2 text-xs text-muted-text">{notes.join(' · ')}</p>}
      <p className="mt-3 text-sm text-muted-text">
        {equipmentToShip
          ? <>Once every assignment is marked Complete, we&apos;ll start getting your {equipmentToShip} ready to ship.</>
          : <>Once every assignment is marked Complete, you&apos;re all set for class.</>}
      </p>
    </section>
  )
}

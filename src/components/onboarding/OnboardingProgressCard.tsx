import Link from 'next/link'
import { ONBOARDING_PRACTICE_LINKS } from '@/lib/onboarding'
import type { ShippingStage } from '@/lib/hardware-shipping'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

function PracticeLinks() {
  return (
    <>
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
    </>
  )
}

/**
 * Top of an Enrollment Readiness course's outline: how far the student has got. Once every
 * counted assignment is Complete it congratulates them, and while their equipment is on its
 * way it points them back to the tasks that come after it arrives (e.g. Receiving Your Laptop).
 */
export default function OnboardingProgressCard({
  courseId,
  done,
  total,
  finished,
  waitingOnStaff,
  needsRevision,
  equipmentToShip,
  shipping,
  lastTasks,
}: {
  courseId: string
  done: number
  total: number
  finished: boolean
  /** Turned in (or a staff check-off) and not marked yet */
  waitingOnStaff: number
  needsRevision: number
  /** What we ship them, in words ("laptop", "laptop and hotspot"), or null if nothing */
  equipmentToShip: string | null
  /** Where their equipment is */
  shipping: ShippingStage
  /** Work that comes after finishing (doesn't count toward it) that they haven't turned in */
  lastTasks: { id: string; title: string }[]
}) {
  const equipment = equipmentToShip ?? 'equipment'
  // Practice links only once their laptop has arrived (or they had nothing to wait for)
  const hasLaptop = shipping === 'arrived' || shipping === 'nothing'
  const isAre = equipmentToShip?.includes(' and ') ? 'are' : 'is'
  const myEquipment = (
    <Link href={`/student/courses/${courseId}/equipment`} className="font-semibold text-teal-primary hover:underline">My Equipment</Link>
  )

  if (finished && lastTasks.length > 0) {
    const tasks = plural(lastTasks.length, 'task', 'tasks')
    const heading =
      shipping === 'to_ship' ? `Congratulations! We're getting your ${equipment} ready to ship.`
      : shipping === 'on_the_way' ? `Congratulations! Your ${equipment} ${isAre} on the way.`
      : "Congratulations, you're almost done!"
    return (
      <section aria-labelledby="onboarding-done-heading" className="mb-8 rounded-2xl border border-teal-primary/30 bg-teal-light p-6">
        <h2 id="onboarding-done-heading" className="text-lg font-bold text-dark-text">
          <span aria-hidden="true">🎉 </span>{heading}
        </h2>
        <p className="mt-2 text-sm text-dark-text">
          You finished your Enrollment Readiness tasks, and we are so excited for you to start this journey with us.
        </p>
        <p className="mt-3 text-sm font-semibold text-dark-text">
          {shipping === 'to_ship' && <>When it arrives, come back here to finish your last {tasks}:</>}
          {shipping === 'on_the_way' && <>When it arrives, click <strong>I got it</strong> on {myEquipment}, then come back here to finish your last {tasks}:</>}
          {shipping === 'arrived' && <>Your {equipment} arrived. Finish your last {tasks}:</>}
          {shipping === 'nothing' && <>Finish your last {tasks}:</>}
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {lastTasks.map(t => (
            <li key={t.id}>
              <Link href={`/student/courses/${courseId}/assignments/${t.id}`} className="text-sm font-semibold text-teal-primary hover:underline">
                {t.title} →
              </Link>
            </li>
          ))}
        </ul>
        {shipping === 'to_ship' && (
          <p className="mt-3 text-sm text-muted-text">Watch {myEquipment} for the tracking number once it ships.</p>
        )}
        {hasLaptop && <PracticeLinks />}
      </section>
    )
  }

  if (finished) {
    return (
      <section aria-labelledby="onboarding-done-heading" className="mb-8 rounded-2xl border border-teal-primary/30 bg-teal-light p-6">
        <h2 id="onboarding-done-heading" className="text-lg font-bold text-dark-text">
          <span aria-hidden="true">🎉 </span>Congratulations, you finished Enrollment Readiness!
        </h2>
        <p className="mt-2 text-sm text-dark-text">
          We are so excited for you to start this journey with us.
        </p>
        {hasLaptop && <PracticeLinks />}
        {shipping === 'to_ship' && (
          <p className="mt-4 text-sm text-muted-text">Watch {myEquipment} for the tracking number once we ship your {equipment}.</p>
        )}
        {shipping === 'on_the_way' && (
          <p className="mt-4 text-sm text-muted-text">Your {equipment} {isAre} on the way. The tracking number is on {myEquipment}.</p>
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

import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import CohortPicker from '@/components/onboarding/CohortPicker'
import { getOnboardingViewer } from '@/lib/onboarding-access'
import { loadCohorts, loadOnboardingCohort, type OnboardingRow } from '@/lib/onboarding-server'
import { ONBOARDING_STAGE_LABELS, onboardingStage, pacificShortDate, pickDefaultCohort, sortCohorts, type OnboardingStage } from '@/lib/onboarding'
import { pacificToday } from '@/lib/hardware-reminders'
import { formatDateOnly } from '@/lib/hardware'

export const dynamic = 'force-dynamic'

const FILTERS = ['all', 'invited', 'in_progress', 'done', 'moved_on', 'to_mark'] as const
type Filter = (typeof FILTERS)[number]

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border/40" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`${done} of ${total} complete`}>
      <div className={`h-full rounded-full ${done === total && total > 0 ? 'bg-green-600' : 'bg-teal-primary'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ course?: string; filter?: string }> }) {
  const viewer = await getOnboardingViewer()
  const params = await searchParams
  const admin = createServiceSupabaseClient()
  const today = pacificToday()
  const cohorts = sortCohorts(await loadCohorts(admin), today)
  const course = cohorts.find(c => c.id === params.course) ?? pickDefaultCohort(cohorts, today)
  const filter: Filter = (FILTERS as readonly string[]).includes(params.filter ?? '') ? params.filter as Filter : 'all'

  const nav = <InstructorTopNav name={viewer.name} role={viewer.role} breadcrumbs={[{ label: 'Dashboard', href: '/instructor' }, { label: 'New Student Onboarding' }]} />

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        {nav}
        <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-8 py-10 focus:outline-none">
          <h1 className="text-2xl font-bold text-dark-text mb-2">New Student Onboarding</h1>
          <div className="bg-surface rounded-2xl border border-border p-6 text-sm text-muted-text">
            No Enrollment Readiness courses yet. Tick <strong className="text-dark-text">Enrollment Readiness</strong> on a course&apos;s
            General Info page (or when creating a course) and its students show up here.
          </div>
        </main>
      </div>
    )
  }

  const { rows, invites, assignments } = await loadOnboardingCohort(admin, course, today)
  const stageOf = (r: OnboardingRow): OnboardingStage => onboardingStage(r.progress.finished, r.inNextCourse)
  const counts: Record<Filter, number> = {
    all: rows.length + invites.length,
    invited: invites.length,
    in_progress: rows.filter(r => stageOf(r) === 'in_progress').length,
    done: rows.filter(r => stageOf(r) === 'done').length,
    moved_on: rows.filter(r => stageOf(r) === 'moved_on').length,
    to_mark: rows.filter(r => r.progress.toMark > 0).length,
  }
  const shown = rows.filter(r =>
    filter === 'all' ? true
    : filter === 'invited' ? false
    : filter === 'to_mark' ? r.progress.toMark > 0
    : stageOf(r) === filter,
  )
  const toMarkTotal = rows.reduce((n, r) => n + r.progress.toMark, 0)
  const countedTotal = assignments.filter(a => a.counts_toward_onboarding !== false && !a.is_optional && !a.is_bonus).length
  const href = (f: Filter) => `/instructor/onboarding?course=${course.id}${f === 'all' ? '' : `&filter=${f}`}`

  return (
    <div className="min-h-screen bg-background">
      {nav}
      <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-8 py-10 focus:outline-none">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">New Student Onboarding</h1>
            <p className="text-sm text-muted-text mt-1">
              <Link href={`/instructor/courses/${course.id}`} className="font-semibold text-dark-text hover:text-teal-primary">{course.name}</Link>
              {course.start_date && <> · {formatDateOnly(course.start_date.slice(0, 10))}{course.end_date && <> – {formatDateOnly(course.end_date.slice(0, 10))}</>}</>}
              {' · '}{rows.length} {rows.length === 1 ? 'student' : 'students'}
              {invites.length > 0 && <> · {invites.length} invited</>}
              {' · '}{countedTotal} {countedTotal === 1 ? 'assignment counts' : 'assignments count'} toward finishing
            </p>
          </div>
          <CohortPicker cohorts={cohorts.map(c => ({ id: c.id, name: c.name }))} selectedId={course.id} />
        </div>

        {toMarkTotal > 0 && (
          <section aria-label="Needs you" className="badge-amber border rounded-xl px-4 py-3 mb-6 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
            <strong>Needs you</strong>
            <Link href={href('to_mark')} className="underline font-semibold">
              {toMarkTotal} {toMarkTotal === 1 ? 'assignment' : 'assignments'} to mark Complete ({counts.to_mark} {counts.to_mark === 1 ? 'student' : 'students'})
            </Link>
          </section>
        )}

        <nav aria-label="Filter students" className="flex gap-1 overflow-x-auto border-b border-border mb-4">
          {(['all', 'invited', 'in_progress', 'done', 'moved_on'] as const).map(f => (
            <Link
              key={f}
              href={href(f)}
              aria-current={filter === f ? 'page' : undefined}
              className={`whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
                filter === f ? 'border-teal-primary text-teal-primary' : 'border-transparent text-muted-text hover:text-dark-text'
              }`}
            >
              {f === 'all' ? 'All' : ONBOARDING_STAGE_LABELS[f]} <span className="font-normal">({counts[f]})</span>
            </Link>
          ))}
          {filter === 'to_mark' && (
            <span className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px border-teal-primary text-teal-primary">To mark Complete ({counts.to_mark})</span>
          )}
        </nav>

        {(filter === 'all' || filter === 'invited') && invites.length > 0 && (
          <section aria-labelledby="invited-heading" className="mb-6">
            <h2 id="invited-heading" className="text-xs font-bold uppercase tracking-wide text-muted-text mb-2">Invited, hasn&apos;t signed up yet</h2>
            <ul className="bg-surface rounded-2xl border border-border divide-y divide-border">
              {invites.map(i => (
                <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="text-dark-text">{i.email}</span>
                  <span className="text-muted-text">Invited {pacificShortDate(i.resent_at ?? i.invited_at, true)}{i.resent_at ? ' (resent)' : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {filter !== 'invited' && (
          shown.length === 0 ? (
            <p className="bg-surface rounded-2xl border border-border p-6 text-sm text-muted-text">No students here.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map(r => {
                const p = r.progress
                const stage = stageOf(r)
                return (
                  <li key={r.student.id} className="bg-surface rounded-2xl border border-border p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                      <div className="min-w-0 flex-1 basis-56">
                        <Link href={`/instructor/onboarding/${course.id}/students/${r.student.id}`} className="font-semibold text-dark-text hover:text-teal-primary">
                          {r.student.name ?? r.student.email}
                        </Link>
                        <p className="text-xs text-muted-text truncate">{r.student.email}</p>
                      </div>
                      <div className="flex-1 basis-56 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1.5 text-sm">
                          <span className="font-semibold text-dark-text">{p.done} of {p.total} complete</span>
                          {stage === 'done' && <span className="text-xs font-semibold text-green-700">✓ Done{r.finishedAt ? ` ${pacificShortDate(r.finishedAt)}` : ''}</span>}
                          {stage === 'moved_on' && <span className="text-xs font-semibold text-teal-primary">Moved on</span>}
                        </div>
                        <ProgressBar done={p.done} total={p.total} />
                        <p className="mt-1.5 text-xs text-muted-text flex flex-wrap gap-x-3">
                          {p.toMark > 0 && <span className="font-semibold text-amber-700">{p.toMark} to mark Complete</span>}
                          {p.needsRevision > 0 && <span>{p.needsRevision} needs revision</span>}
                          {p.overdue > 0 && <span className="font-semibold text-red-600">{p.overdue} overdue</span>}
                          {p.notStarted > 0 && <span>{p.notStarted} not started</span>}
                        </p>
                      </div>
                      <Link href={`/instructor/onboarding/${course.id}/students/${r.student.id}`} className="self-center whitespace-nowrap text-sm font-semibold text-teal-primary hover:underline">
                        Checklist →
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </main>
    </div>
  )
}

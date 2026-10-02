import { ChevronDown } from 'lucide-react'
import SkillTrendChart from '@/components/ui/SkillTrendChart'
import { formatDateOnly, formatTimestamp, type SkillTrend, type TrendGoal } from '@/lib/confidence-trend'

// A reached goal's "what helped" answer, read-only (instructors see this too), or a plain
// "Not answered yet" — never worded as a shortfall.
function WhatHelpedAnswer({ goal }: { goal: TrendGoal }) {
  if (!goal.met) return null
  if (!goal.met.answered) return <p className="mt-1 text-xs text-muted-text">What helped: Not answered yet</p>
  return (
    <div className="mt-1 text-xs text-muted-text">
      <p>What helped:</p>
      <ul className="list-disc pl-5">
        {goal.met.answerLabels.map(label => <li key={label}>{label}</li>)}
      </ul>
    </div>
  )
}

function GoalLine({ goal }: { goal: TrendGoal }) {
  return (
    <>
      <p className="text-sm text-dark-text">
        {goal.isMaintain
          ? 'Maintaining this rating'
          : <>Goal <strong>{goal.goal}</strong>{goal.targetDate ? <> · target date {formatDateOnly(goal.targetDate)}</> : null}</>}
        <span className="text-muted-text"> · set {formatTimestamp(goal.setAt)}</span>
        {goal.met && <span className="text-muted-text"> · reached {formatTimestamp(goal.met.metAt)}</span>}
      </p>
      {goal.studyPlanLabels.length > 0 && (
        <div className="mt-1 text-xs text-muted-text">
          <p>Planned study methods:</p>
          <ul className="list-disc pl-5">
            {goal.studyPlanLabels.map(label => <li key={label}>{label}</li>)}
          </ul>
        </div>
      )}
      {goal.met && <WhatHelpedAnswer goal={goal} />}
    </>
  )
}

// The current goal at a glance: the target rating and date, and the study methods the student
// planned to get there.
function GoalPanel({ goal, pendingNew, action }: { goal: TrendGoal | null; pendingNew: boolean; action?: React.ReactNode }) {
  if (!goal) {
    return (
      <div className="mt-4 rounded-xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-text mb-2">Current goal</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-muted-text">
            {pendingNew ? "You'll set a new goal the next time you rate this skill." : 'No goal set for this skill yet.'}
          </p>
          {action}
        </div>
      </div>
    )
  }
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-text mb-2">Current goal</p>
      {/* Goal details on the left, planned study methods beside them (stacked on narrow screens). */}
      <div className="grid gap-x-12 gap-y-4 sm:grid-cols-[max-content_1fr] lg:gap-x-24 xl:gap-x-40">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-text">Goal</dt>
          <dd className="font-semibold text-dark-text">{goal.isMaintain ? 'Maintaining this rating' : `${goal.goal} / 10`}</dd>
          {goal.targetDate && (
            <>
              <dt className="text-muted-text">Target date</dt>
              <dd className="font-semibold text-dark-text">{formatDateOnly(goal.targetDate)}</dd>
            </>
          )}
          <dt className="text-muted-text">Date set</dt>
          <dd className="font-semibold text-dark-text">{formatTimestamp(goal.setAt)}</dd>
          {goal.met && (
            <>
              <dt className="text-muted-text">Reached</dt>
              <dd className="font-semibold text-dark-text">{formatTimestamp(goal.met.metAt)}</dd>
            </>
          )}
        </dl>
        {goal.studyPlanLabels.length > 0 && (
          <div className="text-sm">
            <p className="text-muted-text">Planned study methods</p>
            <ul className="mt-1 list-disc pl-5 text-dark-text">
              {goal.studyPlanLabels.map(label => <li key={label}>{label}</li>)}
            </ul>
          </div>
        )}
      </div>
      {goal.met && <WhatHelpedAnswer goal={goal} />}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// One skill's trend: chart, current goal, earlier goals, and the dated rating list (which is
// also the non-visual equivalent of the chart). `showCourseContext` (instructor view) badges
// ratings from other courses as read-only context. `children` renders in the footer.
export default function SkillTrendCard({ trend, showCourseContext = false, collapsible = false, goalAction, children }: {
  trend: SkillTrend
  showCourseContext?: boolean
  // Instructor view: closed to begin with, showing only the skill name and latest rating until opened.
  collapsible?: boolean
  // A student-only control shown inside the goal panel ("Set a goal", or "Reactivate" on a mastered
  // skill), beside the goal status.
  goalAction?: React.ReactNode
  children?: React.ReactNode
}) {
  const historyGoals =
    trend.isMastered && trend.currentGoal && !trend.currentGoal.isMaintain
      ? [trend.currentGoal, ...trend.previousGoals]
      : trend.previousGoals
  // Name and latest rating: the card's header, or the closed summary of a collapsible card.
  const ratingList = (
    <ol className="mt-2 space-y-1.5 text-sm">
      {trend.ratings.map((r, i) => (
        <li key={`${r.date}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-dark-text">
          <strong className="w-6">{r.value}</strong>
          <span className="text-muted-text">{formatTimestamp(r.date)}</span>
          <span>{r.assignmentTitle ?? 'Removed assignment'}</span>
          {r.courseName && <span className="text-muted-text">· {r.courseName}</span>}
          {showCourseContext && !r.isCurrentCourse && (
            <span className="badge-amber text-xs px-2 py-0.5 rounded-full border">Earlier course (read-only)</span>
          )}
        </li>
      ))}
    </ol>
  )
  // A collapsible card (instructor view) is a compact row, so its text sits one size down.
  const name = <h3 className={`${collapsible ? 'text-sm' : 'text-base'} font-bold text-dark-text`}>{trend.name}</h3>
  const latest = <p className={`${collapsible ? 'text-xs' : 'text-sm'} text-muted-text`}>Latest rating <strong className="text-dark-text">{trend.latestRating}</strong> / 10</p>
  const body = (
    <>
      {trend.isMastered && (
        <p className="mb-3 text-sm text-dark-text">
          Mastered {trend.masteredDates.map(formatTimestamp).join(', ')}
        </p>
      )}
      {trend.previouslyMastered && (
        <p className="mb-3 text-sm text-dark-text">
          Previously mastered {trend.masteredDates.map(formatTimestamp).join(', ')}
          {trend.reactivatedDates.length > 0 && <> · reactivated {trend.reactivatedDates.map(formatTimestamp).join(', ')}</>}
          {trend.pendingNew && <span className="text-muted-text"> · it will come back as a new skill on the next assignment it is tagged on</span>}
        </p>
      )}

      <SkillTrendChart trend={trend} />

      {/* A maintained skill (mastered, or rated 10 once with "maintaining this rating") has nothing left to
          work toward, so no goal panel: just that it is being maintained. A mastered skill's numeric goal,
          if any, stays viewable (with its answer) in the history below. */}
      {trend.isMastered || trend.goalStatus === 'maintain' ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border p-4">
          <p className="text-sm text-dark-text">You&apos;re now maintaining this rating.</p>
          {goalAction}
        </div>
      ) : (
        <GoalPanel goal={trend.currentGoal} pendingNew={trend.pendingNew} action={goalAction} />
      )}

      {historyGoals.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-teal-primary">Earlier goals ({historyGoals.length})</summary>
          <ul className="mt-2 space-y-3">
            {historyGoals.map(g => (
              <li key={g.setAt} className="rounded-xl border border-border p-3"><GoalLine goal={g} /></li>
            ))}
          </ul>
        </details>
      )}

      {/* The dated list is the non-visual equivalent of the chart, and also shows each rating's assignment and course. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-teal-primary">All ratings ({trend.ratings.length})</summary>
        {ratingList}
      </details>

      {children}
    </>
  )

  if (collapsible) {
    return (
      <section aria-label={trend.name} className="bg-surface border-2 border-border rounded-2xl">
        <details className="group">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-2.5">
            <span className="flex items-center gap-2">
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-text transition-transform group-not-open:-rotate-90" />
              {name}
            </span>
            {latest}
          </summary>
          <div className="px-4 pb-4 pt-1">{body}</div>
        </details>
      </section>
    )
  }

  return (
    <section aria-label={trend.name} className="bg-surface border-2 border-border rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        {name}
        {latest}
      </div>
      {body}
    </section>
  )
}

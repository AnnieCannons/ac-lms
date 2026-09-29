import SkillTrendChart from '@/components/ui/SkillTrendChart'
import { formatDateOnly, formatTimestamp, type SkillTrend, type TrendGoal } from '@/lib/confidence-trend'

function GoalLine({ goal }: { goal: TrendGoal }) {
  return (
    <>
      <p className="text-sm text-dark-text">
        {goal.isMaintain
          ? 'Maintaining this rating'
          : <>Goal <strong>{goal.goal}</strong>{goal.targetDate ? <> · target date {formatDateOnly(goal.targetDate)}</> : null}</>}
        <span className="text-muted-text"> · set {formatTimestamp(goal.setAt)}</span>
      </p>
      {goal.studyPlanLabels.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-muted-text">
          {goal.studyPlanLabels.map(label => <li key={label}>{label}</li>)}
        </ul>
      )}
    </>
  )
}

// The current goal at a glance: the target rating and date, and the study methods the student
// planned to get there.
function GoalPanel({ goal, pendingNew }: { goal: TrendGoal | null; pendingNew: boolean }) {
  if (!goal) {
    return (
      <div className="mt-4 rounded-xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-text mb-2">Current goal</p>
        <p className="text-sm text-muted-text">
          {pendingNew ? "You'll set a new goal the next time you rate this skill." : 'No goal set for this skill yet.'}
        </p>
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
    </div>
  )
}

// One skill's trend: chart, current goal, earlier goals, and the dated rating list (which is
// also the non-visual equivalent of the chart). `showCourseContext` (instructor view) badges
// ratings from other courses as read-only context. `children` renders in the footer.
export default function SkillTrendCard({ trend, showCourseContext = false, children }: {
  trend: SkillTrend
  showCourseContext?: boolean
  children?: React.ReactNode
}) {
  return (
    <section aria-label={trend.name} className="bg-surface border-2 border-border rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-dark-text">{trend.name}</h3>
        <p className="text-sm text-muted-text">Latest rating <strong className="text-dark-text">{trend.latestRating}</strong> / 10</p>
      </div>

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

      <GoalPanel goal={trend.currentGoal} pendingNew={trend.pendingNew} />

      {trend.previousGoals.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-teal-primary">Earlier goals ({trend.previousGoals.length})</summary>
          <ul className="mt-2 space-y-3">
            {trend.previousGoals.map(g => (
              <li key={g.setAt} className="rounded-xl border border-border p-3"><GoalLine goal={g} /></li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-teal-primary">All ratings ({trend.ratings.length})</summary>
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
      </details>

      {children}
    </section>
  )
}

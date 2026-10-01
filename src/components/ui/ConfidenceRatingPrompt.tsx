'use client'

import GoalFields, { MAX_RATING, RATING_LABELS, SCALE, defaultTargetDate, suggestedGoal } from '@/components/ui/GoalFields'
import type { ConfidenceSkillWithStatus } from '@/lib/confidence-tracker-actions'
import type { GoalState } from '@/lib/confidence-tracker-validation'

interface Props {
  skills: ConfidenceSkillWithStatus[]
  value: Record<string, number>
  onChange: (skillId: string, rating: number | null) => void
  goals: Record<string, GoalState>
  onGoalChange: (skillId: string, goal: Partial<GoalState> | null) => void
  disabled?: boolean
}

export default function ConfidenceRatingPrompt({ skills, value, onChange, goals, onGoalChange, disabled }: Props) {
  if (skills.length === 0) return null

  function handleRatingClick(skill: ConfidenceSkillWithStatus, n: number, selected: boolean) {
    const next = selected ? null : n
    onChange(skill.id, next)
    if (!skill.canSetGoal) return

    if (next === null) {
      onGoalChange(skill.id, null)
      return
    }

    const priorGoalState = goals[skill.id]
    if (!priorGoalState || priorGoalState.goal == null) {
      onGoalChange(skill.id, {
        goal: suggestedGoal(next),
        // Maintaining a rating of 10 doesn't work toward a goal, so no target
        // date/study plan applies — only pre-fill them for a real numeric goal.
        targetDate: next === MAX_RATING ? '' : defaultTargetDate(),
        studyPlan: [],
        studyPlanOther: '',
      })
      return
    }

    // A goal was already in progress and the rating just changed to a different value —
    // always re-suggest the goal against the new rating (current + 2, capped at 10, or
    // "maintain" at the max), rather than only reclamping when the old value becomes
    // invalid. Switching to "maintain" needs nothing else, but switching to (or between)
    // a numeric goal must restore a target date if it's currently blank — e.g. coming
    // from a prior "maintain" state, which deliberately leaves it empty.
    if (next === MAX_RATING) {
      onGoalChange(skill.id, { goal: 'maintain' })
    } else {
      onGoalChange(skill.id, {
        goal: suggestedGoal(next),
        targetDate: priorGoalState.targetDate || defaultTargetDate(),
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
        How confident do you feel on the following skill(s)?
      </p>
      {skills.map(skill => {
        const rating = value[skill.id]
        const goalState = goals[skill.id]
        const showGoalSection = skill.canSetGoal && rating != null
        const isMaintaining = goalState?.goal === 'maintain'

        return (
          <div key={skill.id} className="bg-background border border-border rounded-xl p-4 flex flex-col gap-2">
            <p className="text-sm text-dark-text flex items-center gap-2">
              {skill.name}
              {skill.isNew && (
                <span className="badge-new text-xs font-semibold px-2 py-0.5 rounded-full border">New</span>
              )}
            </p>
            <div role="radiogroup" aria-label={`Confidence rating for ${skill.name}`} className="flex flex-wrap gap-1.5">
              {SCALE.map(n => {
                const selected = rating === n
                return (
                  <div key={n} className="relative group">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${n}`}
                      disabled={disabled}
                      onClick={e => {
                        handleRatingClick(skill, n, selected)
                        // Clicking focuses the button, which keeps the tooltip visible via
                        // group-focus-within even after the mouse moves away — blur it so
                        // the tooltip only lingers for genuine hover/keyboard focus, not a click.
                        e.currentTarget.blur()
                      }}
                      className={`w-8 h-8 rounded-full border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        selected
                          ? "bg-teal-primary text-white border-teal-primary"
                          : "border-border text-muted-text hover:border-teal-primary hover:text-teal-primary"
                      }`}
                    >
                      {n}
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 scale-95 rounded-lg bg-dark-text px-2.5 py-1.5 text-center text-xs text-white opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
                    >
                      {RATING_LABELS[n]}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* A rating of 10 has no numeric goal to set; the "you're now maintaining this rating" message
                is shown after submission (see ConfidenceMaintaining), not while rating. */}
            {showGoalSection && !isMaintaining && (
              <div className="mt-2 pt-3 border-t border-border flex flex-col gap-3">
                <>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                        Set a goal for this skill?
                      </p>
                      {goalState?.goal != null && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onGoalChange(skill.id, null)}
                          className="text-xs text-muted-text hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                    <GoalFields
                      skillId={skill.id}
                      skillName={skill.name}
                      rating={rating!}
                      goalState={goalState}
                      onGoalChange={patch => onGoalChange(skill.id, patch)}
                      disabled={disabled}
                    />
                </>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

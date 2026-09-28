'use client'

import { addDays, format } from 'date-fns'
import DatePickerField from '@/components/ui/DatePickerField'
import type { ConfidenceSkillWithStatus } from '@/lib/confidence-tracker-actions'
import { STUDY_PLAN_OPTIONS, type GoalState } from '@/lib/confidence-tracker-validation'

interface Props {
  skills: ConfidenceSkillWithStatus[]
  value: Record<string, number>
  onChange: (skillId: string, rating: number | null) => void
  goals: Record<string, GoalState>
  onGoalChange: (skillId: string, goal: Partial<GoalState> | null) => void
  disabled?: boolean
}

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)
const MAX_RATING = 10
const TARGET_DATE_DEFAULT_DAYS_OUT = 7

// Adapted from the original Confidence Tracker's 1-10 scale (ConfidenceTracker.tsx's
// SCORE_LABELS), reworded to apply to any tagged skill (not just coding) since instructors
// can tag assignments with skills like "Canva" or "Presenting," not only technical ones.
// Kept as its own copy since the two systems are deliberately independent.
const RATING_LABELS: Record<number, string> = {
  1: "😳 I just learned this exists",
  2: "👀 I've seen examples of this",
  3: "🤔 I can follow along with guidance",
  4: "😅 I've practiced this, but it still feels fuzzy",
  5: "🙂 I understand the basics",
  6: "😊 I can complete tasks independently",
  7: "💬 I can explain what I did and why",
  8: "💡 I can solve new problems with this skill",
  9: "🤓 I can look at someone else's work and understand it",
  10: "🌟 I could teach this to someone just starting out",
}

function suggestedGoal(rating: number): number | 'maintain' {
  return rating === MAX_RATING ? 'maintain' : Math.min(rating + 2, MAX_RATING)
}

function defaultTargetDate(): string {
  return format(addDays(new Date(), TARGET_DATE_DEFAULT_DAYS_OUT), 'yyyy-MM-dd')
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
        const numericGoal = typeof goalState?.goal === 'number' ? goalState.goal : null

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

            {showGoalSection && (
              <div className="mt-2 pt-3 border-t border-border flex flex-col gap-3">
                {isMaintaining ? (
                  <p className="text-sm text-dark-text">
                    You&apos;re at the top of the scale! You&apos;re now maintaining this rating.
                  </p>
                ) : (
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
                    <div role="radiogroup" aria-label={`Goal for ${skill.name}`} className="flex flex-wrap gap-1.5">
                      {SCALE.filter(n => n >= rating! + 1).map(n => {
                        const selected = numericGoal === n
                        return (
                          <div key={n} className="relative group">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              aria-label={`Goal ${n}`}
                              disabled={disabled}
                              onClick={e => {
                                onGoalChange(
                                  skill.id,
                                  selected
                                    ? null
                                    // Preserve an already-set target date (e.g. picking a
                                    // different goal value); restore the default if it's
                                    // currently blank (e.g. re-picking a goal after "Skip"
                                    // reset the whole state).
                                    : { goal: n, targetDate: goalState?.targetDate || defaultTargetDate() }
                                )
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
                  </>
                )}

                {goalState?.goal != null && !isMaintaining && (
                  <>
                    <DatePickerField
                      label="Target date"
                      value={goalState.targetDate}
                      onChange={val => onGoalChange(skill.id, { targetDate: val })}
                      minDate={addDays(new Date(), 1)}
                      disabled={disabled}
                    />

                    <div className="flex flex-col gap-2">
                      <span id={`study-plan-label-${skill.id}`} className="text-sm font-medium text-dark-text">
                        How do you plan to work on this? (choose all that apply)
                      </span>
                      <div
                        role="group"
                        aria-labelledby={`study-plan-label-${skill.id}`}
                        className="flex flex-col gap-2"
                      >
                        {STUDY_PLAN_OPTIONS.map(opt => {
                          const checked = goalState.studyPlan.includes(opt.value)
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              disabled={disabled}
                              onClick={() =>
                                onGoalChange(skill.id, {
                                  studyPlan: checked
                                    ? goalState.studyPlan.filter(v => v !== opt.value)
                                    : [...goalState.studyPlan, opt.value],
                                  studyPlanOther:
                                    opt.value === 'other' && checked ? '' : goalState.studyPlanOther,
                                })
                              }
                              className="flex items-start gap-3 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span
                                aria-hidden="true"
                                className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                  checked
                                    ? "bg-teal-primary border-teal-primary"
                                    : "border-muted-text group-hover:border-teal-primary"
                                }`}
                              >
                                {checked && (
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </span>
                              <p className="text-sm text-dark-text">{opt.label}</p>
                            </button>
                          )
                        })}
                      </div>
                      {goalState.studyPlan.includes('other') && (
                        <input
                          type="text"
                          value={goalState.studyPlanOther}
                          disabled={disabled}
                          placeholder="Describe your plan…"
                          onChange={e => onGoalChange(skill.id, { studyPlanOther: e.target.value })}
                          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

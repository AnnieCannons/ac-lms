'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { moveRovingFocus } from '@/lib/roving-focus'
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
  // null until the student opens or closes the maintained row: until then it opens by itself when a
  // rating is restored for one of its skills (kept across in-app navigation), so that rating isn't hidden.
  const [maintainedToggled, setMaintainedToggled] = useState<boolean | null>(null)
  if (skills.length === 0) return null

  // Skills the student is maintaining (latest rating 10) sit in one collapsed row, already at 10:
  // nothing is saved for them unless the student picks a rating, so they never lengthen the form.
  const maintained = skills.filter(s => s.isMaintaining)
  const others = skills.filter(s => !s.isMaintaining)
  const changedCount = maintained.filter(s => value[s.id] != null).length
  const showMaintained = maintainedToggled ?? changedCount > 0

  function handleRatingClick(skill: ConfidenceSkillWithStatus, n: number, selected: boolean) {
    const next = selected ? null : n
    onChange(skill.id, next)
    if (!skill.canSetGoal) return

    // No goal is set for a skill at 10 (it is simply maintained), or when the rating is cleared.
    if (next === null || next === MAX_RATING) {
      onGoalChange(skill.id, null)
      return
    }

    const priorGoalState = goals[skill.id]
    if (!priorGoalState || priorGoalState.goal == null) {
      onGoalChange(skill.id, {
        goal: suggestedGoal(next),
        targetDate: defaultTargetDate(),
        studyPlan: [],
        studyPlanOther: '',
      })
      return
    }

    // A goal was already in progress and the rating just changed to a different value — always
    // re-suggest the goal against the new rating (current + 2, capped at 10), keeping any target date.
    onGoalChange(skill.id, {
      goal: suggestedGoal(next),
      targetDate: priorGoalState.targetDate || defaultTargetDate(),
    })
  }

  // `nested`: inside the maintained row's card, so it has no card of its own, only a divider above it.
  function renderSkill(skill: ConfidenceSkillWithStatus, nested = false) {
    const rating = value[skill.id]
    const goalState = goals[skill.id]
    const showGoalSection = skill.canSetGoal && rating != null && rating < MAX_RATING
    // A maintained skill the student has not touched shows 10 as its current value, not as a saved rating.
    const untouchedMaintained = skill.isMaintaining && rating == null

    return (
      <div
        key={skill.id}
        className={nested ? 'border-t border-border pt-4 flex flex-col gap-2' : 'bg-background border border-border rounded-xl p-4 flex flex-col gap-2'}
      >
        <p className="text-sm text-dark-text flex items-center gap-2">
          {skill.name}
          {skill.isNew && (
            <span className="badge-new text-xs font-semibold px-2 py-0.5 rounded-full border">New</span>
          )}
        </p>
        <div
          role="radiogroup"
          aria-label={`Confidence rating for ${skill.name}`}
          className="flex flex-wrap gap-1.5"
          onKeyDown={e => moveRovingFocus(e, '[role="radio"]')}
        >
          {SCALE.map(n => {
            // One Tab stop per skill: the chosen rating, else the shown current 10, else the first.
            const tabStop = n === (rating ?? (untouchedMaintained ? MAX_RATING : SCALE[0]))
            const selected = rating === n
            const current = untouchedMaintained && n === MAX_RATING
            return (
              <div key={n} className="relative group">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected || current}
                  aria-label={current ? `${n}, current rating` : `${n}`}
                  tabIndex={tabStop ? 0 : -1}
                  disabled={disabled}
                  onClick={e => {
                    handleRatingClick(skill, n, selected)
                    // Clicking focuses the button, which keeps the tooltip visible via
                    // group-focus-within even after the mouse moves away — blur it after a mouse
                    // click (detail > 0) so the tooltip doesn't linger. A keyboard user keeps their place.
                    if (e.detail > 0) e.currentTarget.blur()
                  }}
                  className={`w-8 h-8 rounded-full border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    selected
                      ? "bg-teal-primary text-white border-teal-primary"
                      : current
                        ? "border-teal-primary text-teal-primary bg-teal-light"
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

        {/* A rating of 10 has no goal to set: the skill is simply maintained. */}
        {showGoalSection && (
          <div className="mt-2 pt-3 border-t border-border flex flex-col gap-3">
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
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
        How confident do you feel on the following skill(s)?
      </p>
      {others.map(skill => renderSkill(skill))}

      {maintained.length > 0 && (
        // One card: the row is its header, and the maintained skills open inside it.
        <div className="rounded-xl border border-border bg-background">
          <button
            type="button"
            aria-expanded={showMaintained}
            aria-controls="confidence-maintained-skills"
            onClick={() => setMaintainedToggled(!showMaintained)}
            className="flex w-full flex-col gap-1 rounded-xl px-4 py-3 text-left hover:bg-surface"
          >
            <span className="flex w-full items-center justify-between gap-3 text-sm text-dark-text">
              <span>Still feeling confident on your maintaining skills?</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-teal-primary">
                {/* Closed with a changed rating inside: say so, since that rating is still submitted. */}
                {!showMaintained && (changedCount > 0 ? `${changedCount} ${changedCount === 1 ? 'rating' : 'ratings'} changed` : 'Change a rating')}
                <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showMaintained ? '' : '-rotate-90'}`} />
              </span>
            </span>
            {/* Said once for the whole row, and kept visible while it is collapsed. The whole area is the button. */}
            <span className="block text-xs text-muted-text">
              You&apos;re maintaining these skills at 10. Leave them as they are, or pick a number for any that no longer feel like a 10.
            </span>
          </button>
          {showMaintained && (
            <div id="confidence-maintained-skills" className="flex flex-col gap-4 px-4 pb-4">
              {maintained.map(skill => renderSkill(skill, true))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

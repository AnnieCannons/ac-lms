'use client'

import { useState, useTransition } from 'react'
import GoalFields, { defaultTargetDate, suggestedGoal } from '@/components/ui/GoalFields'
import { setSkillGoal } from '@/lib/goal-met-actions'
import type { GoalState, StudyPlan } from '@/lib/confidence-tracker-validation'

interface Props {
  skillId: string
  skillName: string
  // The student's latest rating; the goal must be at least this + 1. Never 10 (no numeric goal
  // exists above the top of the scale), so callers don't render this for a rating of 10.
  rating: number
  onSaved: () => void
  onCancel: () => void
  cancelLabel?: string
  // Heading above the fields; defaults to "Set a goal for <skill>".
  title?: string
  // Put a small "Skip" beside the heading instead of a cancel button at the bottom.
  skipBesideTitle?: boolean
}

// Stand-alone "set a goal" control (Confidence Tracker v2, Phase 6): same rules as setting a
// goal at submission — goal at least current + 1, future target date, at least one study plan.
// Used after a met goal's celebration and from My Skill Confidence.
export default function SetGoalForm({ skillId, skillName, rating, onSaved, onCancel, cancelLabel = 'Not now', title, skipBesideTitle = false }: Props) {
  const [goal, setGoal] = useState<GoalState>({
    goal: suggestedGoal(rating),
    targetDate: defaultTargetDate(),
    studyPlan: [],
    studyPlanOther: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleGoalChange(patch: Partial<GoalState> | null) {
    setGoal(prev =>
      patch === null ? { goal: null, targetDate: '', studyPlan: [], studyPlanOther: '' } : { ...prev, ...patch }
    )
  }

  const complete =
    typeof goal.goal === 'number' &&
    goal.targetDate !== '' &&
    goal.studyPlan.length > 0 &&
    (!goal.studyPlan.includes('other') || goal.studyPlanOther.trim() !== '')

  function save() {
    if (typeof goal.goal !== 'number') return
    setError(null)
    const targetGoal = goal.goal
    startTransition(async () => {
      const result = await setSkillGoal(skillId, {
        goal: targetGoal,
        targetDate: goal.targetDate,
        studyPlan: goal.studyPlan as StudyPlan[],
        studyPlanOther: goal.studyPlan.includes('other') ? goal.studyPlanOther : undefined,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      onSaved()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
          {title ?? `Set a goal for ${skillName}`}
        </p>
        {skipBesideTitle && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-xs text-muted-text hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip
          </button>
        )}
      </div>
      <GoalFields
        skillId={skillId}
        skillName={skillName}
        rating={rating}
        goalState={goal}
        onGoalChange={handleGoalChange}
        disabled={pending}
      />
      {error && (
        <p role="alert" className="alert-error rounded-lg p-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!complete || pending}
          className="rounded-lg bg-teal-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Saving…' : 'Set goal'}
        </button>
        {!skipBesideTitle && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-text hover:text-dark-text disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  )
}

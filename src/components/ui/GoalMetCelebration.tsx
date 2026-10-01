'use client'

import { useState } from 'react'
import SetGoalForm from '@/components/ui/SetGoalForm'
import WhatHelpedForm from '@/components/ui/WhatHelpedForm'

export interface CelebrationDisplayItem {
  skillId: string
  skillName: string
  rating: number
  mastered: boolean
  goal?: {
    outcomeId: string
    target: number
    ownPlanText: string | null
    nextGoalAllowed: boolean
  }
}

interface Props {
  items: CelebrationDisplayItem[]
  onDismiss: () => void
}

type Step = 'question' | 'next' | 'done'

function headline(item: CelebrationDisplayItem): string {
  if (item.mastered && item.goal) return `You've mastered ${item.skillName}, and reached your goal of ${item.goal.target}!`
  if (item.mastered) return `You've mastered ${item.skillName}!`
  return `You reached your goal of ${item.goal?.target} in ${item.skillName}!`
}

function CelebrationRow({ item }: { item: CelebrationDisplayItem }) {
  const [step, setStep] = useState<Step>(item.goal ? 'question' : 'done')
  const [answered, setAnswered] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  function afterQuestion(wasAnswered: boolean) {
    setAnswered(wasAnswered)
    setStep(item.goal?.nextGoalAllowed ? 'next' : 'done')
  }

  return (
    // A divider between skills, so each one's celebration, question and next-goal step read as one block.
    <li className="flex flex-col gap-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-teal-primary/30 [&:not(:first-child)]:pt-4">
      <p role="status" className="font-semibold">
        {headline(item)} <span aria-hidden="true">🎉</span>
      </p>
      {item.mastered && (
        <p className="text-sm">
          It won&apos;t show up on your assignments again, but you can bring it back any time from My Skill Confidence.
        </p>
      )}

      {step === 'question' && item.goal && (
        <WhatHelpedForm
          outcomeId={item.goal.outcomeId}
          skillName={item.skillName}
          ownPlanText={item.goal.ownPlanText}
          onAnswered={() => afterQuestion(true)}
          onSkip={() => afterQuestion(false)}
        />
      )}

      {step === 'next' && (
        <SetGoalForm
          skillId={item.skillId}
          skillName={item.skillName}
          rating={item.rating}
          title="Set a new goal"
          skipBesideTitle
          onSaved={() => {
            setGoalSaved(true)
            setStep('done')
          }}
          onCancel={() => setStep('done')}
        />
      )}

      {step === 'done' && item.goal && (
        <p className="text-sm">
          {answered ? 'Thanks for sharing — your answer is saved. ' : 'You can answer this any time from My Skill Confidence. '}
          {goalSaved && 'Your new goal is set.'}
        </p>
      )}
    </li>
  )
}

// Confidence Tracker v2 Phase 6: the larger moment shown after a first submission when a goal
// is met or a skill is mastered. Replaces the small Phase 5 kudos line for those skills. The
// "what helped" question (met goals only) and the next-goal step are both optional; skipping
// either is the same as walking away.
export default function GoalMetCelebration({ items, onDismiss }: Props) {
  if (items.length === 0) return null

  return (
    <section
      aria-label="Goal celebration"
      className="celebration-card flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <ul className="flex min-w-0 flex-1 flex-col gap-4">
        {items.map(item => (
          <CelebrationRow key={item.skillId} item={item} />
        ))}
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs font-medium underline shrink-0"
        aria-label="Dismiss celebration"
      >
        Dismiss
      </button>
    </section>
  )
}

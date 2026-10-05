'use client'

import { useState } from 'react'
import SetGoalForm from '@/components/ui/SetGoalForm'
import WhatHelpedForm from '@/components/ui/WhatHelpedForm'

export interface CelebrationDisplayItem {
  skillId: string
  skillName: string
  rating: number
  kind: 'goal' | 'returned' | 'first'
  goal?: {
    outcomeId: string
    // null for a return to 10 with no goal.
    target: number | null
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
  if (item.kind === 'goal') return `You reached your goal of ${item.goal?.target} in ${item.skillName}!`
  if (item.kind === 'returned') return `You're back at 10 in ${item.skillName}!`
  return `You're at 10 in ${item.skillName}!`
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
      {item.kind !== 'goal' && (
        <p className="text-sm">
          You&apos;re maintaining this rating. If it ever stops feeling like a 10, you can pick a lower rating on a future assignment.
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
// is reached or a skill is rated 10. Replaces the small Phase 5 kudos line for those skills. The
// "what helped" question (a reached goal, or a return to 10) and the next-goal step are both
// optional; skipping either is the same as walking away. A first-ever 10 asks nothing.
export default function GoalMetCelebration({ items, onDismiss }: Props) {
  if (items.length === 0) return null

  return (
    <section
      aria-label="Goal celebration"
      className="celebration-card flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <ul className="flex min-w-0 flex-1 flex-col gap-4">
        {items.map(item => (
          <CelebrationRow key={item.skillId} item={item} />
        ))}
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        // On a phone the button sits above the content (right-aligned) so the text gets the full width;
        // from `sm` up it goes back beside it. min-h-8 keeps the touch target above 24px.
        className="order-first inline-flex min-h-8 items-center self-end px-2 text-xs font-medium underline shrink-0 sm:order-none sm:self-start"
        aria-label="Dismiss celebration"
      >
        Dismiss
      </button>
    </section>
  )
}

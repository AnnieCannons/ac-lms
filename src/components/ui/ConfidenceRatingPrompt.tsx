'use client'

import type { ConfidenceSkill } from '@/lib/skill-actions'

interface Props {
  skills: ConfidenceSkill[]
  value: Record<string, number>
  onChange: (skillId: string, rating: number | null) => void
  disabled?: boolean
}

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)

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

export default function ConfidenceRatingPrompt({ skills, value, onChange, disabled }: Props) {
  if (skills.length === 0) return null

  return (
    <div className="bg-background rounded-xl border border-border p-4 flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">
        How confident do you feel on the following skill(s)? (optional)
      </p>
      {skills.map(skill => (
        <div key={skill.id} className="flex flex-col gap-2">
          <p className="text-sm text-dark-text">{skill.name}</p>
          <div role="radiogroup" aria-label={`Confidence rating for ${skill.name}`} className="flex flex-wrap gap-1.5">
            {SCALE.map(n => {
              const selected = value[skill.id] === n
              return (
                <div key={n} className="relative group">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${n}`}
                    disabled={disabled}
                    onClick={() => onChange(skill.id, selected ? null : n)}
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
        </div>
      ))}
    </div>
  )
}

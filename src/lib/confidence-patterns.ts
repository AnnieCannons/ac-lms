// Pure, Supabase-free helper for Confidence Tracker v2 Phase 7 (pattern insights). Deliberately
// not a 'use server' module so it stays directly unit-testable.

import { WHAT_HELPED_OPTIONS, OWN_PLAN_VALUE } from '@/lib/confidence-tracker-validation'
import type { SkillTrend } from '@/lib/confidence-trend'

export interface PatternSkillCount {
  skillId: string
  name: string
  count: number
}

export interface PatternMethod {
  value: string
  label: string
  // Answers that named this method (one per goal or return to 10, however many options were picked).
  count: number
  skills: PatternSkillCount[]
}

export interface WhatHelpedPatterns {
  answeredGoals: number
  methods: PatternMethod[]
}

// The student's own study-plan write-in and "Other" text are never listed individually or
// interpreted — they all fold into the single "Other" method.
const methodOf = (value: string): string => (value === OWN_PLAN_VALUE ? 'other' : value)

const METHOD_ORDER = WHAT_HELPED_OPTIONS.map(o => o.value as string)
const METHOD_LABELS: Record<string, string> = Object.fromEntries(WHAT_HELPED_OPTIONS.map(o => [o.value, o.label]))

export function computeWhatHelpedPatterns(trends: SkillTrend[]): WhatHelpedPatterns {
  let answeredGoals = 0
  const byMethod = new Map<string, Map<string, PatternSkillCount>>()

  for (const trend of trends) {
    // A reached goal and a return to 10 with no goal are counted alike: one answer each.
    const answers = [...[trend.currentGoal, ...trend.previousGoals].map(goal => goal?.met), ...trend.reachedTens]
    for (const met of answers) {
      if (!met?.answered || met.answerValues.length === 0) continue

      // De-duplicated per answer, so one answer counts once toward each method it named.
      const methods = new Set<string>()
      for (const raw of met.answerValues) {
        const method = methodOf(raw)
        if (METHOD_LABELS[method]) methods.add(method)
      }
      if (methods.size === 0) continue

      answeredGoals += 1
      for (const method of methods) {
        const skills = byMethod.get(method) ?? new Map<string, PatternSkillCount>()
        const entry = skills.get(trend.skillId) ?? { skillId: trend.skillId, name: trend.name, count: 0 }
        entry.count += 1
        skills.set(trend.skillId, entry)
        byMethod.set(method, skills)
      }
    }
  }

  const methods: PatternMethod[] = [...byMethod.entries()].map(([value, skillMap]) => {
    const skills = [...skillMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    return { value, label: METHOD_LABELS[value], count: skills.reduce((sum, s) => sum + s.count, 0), skills }
  })
  methods.sort((a, b) => b.count - a.count || METHOD_ORDER.indexOf(a.value) - METHOD_ORDER.indexOf(b.value))

  return { answeredGoals, methods }
}

export interface ClassPatterns extends WhatHelpedPatterns {
  // Students with at least one answered goal in the counts. Only a number, never who.
  answeredStudents: number
}

// Phase 8: the same grouping across a class, one trend list per student. Skills sum by skill id; the
// result carries no student identity, so the class view can't point at a person.
export function computeClassPatterns(studentsTrends: SkillTrend[][]): ClassPatterns {
  const combined = computeWhatHelpedPatterns(studentsTrends.flat())
  const answeredStudents = studentsTrends.filter(trends => computeWhatHelpedPatterns(trends).answeredGoals > 0).length
  return { ...combined, answeredStudents }
}

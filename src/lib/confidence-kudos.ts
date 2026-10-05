// Pure, Supabase-free helpers for Confidence Tracker v2 Phase 5 (incremental kudos).
// Deliberately not a 'use server' module so these stay directly unit-testable.

export interface KudosItem {
  skillId: string
  from: number
  to: number
}

export interface PriorRatingRow {
  id: string
  skill_id: string
  rating: number
  created_at: string
}

// Most recent earlier rating per skill, across every assignment and course. Latest
// created_at wins; identical timestamps fall back to the larger id so the result is stable.
export function latestPriorRatingBySkill(rows: PriorRatingRow[]): Map<string, number> {
  const latest = new Map<string, PriorRatingRow>()
  for (const row of rows) {
    const current = latest.get(row.skill_id)
    if (
      !current ||
      row.created_at > current.created_at ||
      (row.created_at === current.created_at && row.id > current.id)
    ) {
      latest.set(row.skill_id, row)
    }
  }
  return new Map([...latest].map(([skillId, row]) => [skillId, row.rating]))
}

// A skill earns kudos only when it was rated on this submission, has an earlier rating, and
// the new rating is higher (even by 1). A first-ever rating has nothing to compare with.
export function computeKudos(
  entries: { skillId: string; rating: number }[],
  priorBySkill: Map<string, number>
): KudosItem[] {
  const items: KudosItem[] = []
  for (const { skillId, rating } of entries) {
    const prior = priorBySkill.get(skillId)
    if (prior !== undefined && rating > prior) items.push({ skillId, from: prior, to: rating })
  }
  return items
}

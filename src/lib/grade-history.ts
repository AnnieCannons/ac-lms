// Shared rule for which grade_history entries are real grading events. Used by
// both the Grade History panel and the readiness score's needs-revision count,
// so the two always agree on how many times work was sent back.

/** Same grade saved again within this window is a double-click, not a new return. */
export const DOUBLE_CLICK_WINDOW_MS = 2 * 60 * 1000

/**
 * Drops entries that repeat the previous entry's grade within
 * DOUBLE_CLICK_WINDOW_MS (keeping the first of each burst). Pass one
 * submission's history; input order is preserved. A same-grade entry further
 * apart is a real second return (e.g. returned, resubmitted, returned again)
 * and is kept.
 */
export function collapseDoubleClicks<T extends { grade: string; graded_at: string }>(entries: T[]): T[] {
  const ascending = [...entries].sort((a, b) => a.graded_at.localeCompare(b.graded_at))
  const dropped = new Set<T>()
  for (let i = 1; i < ascending.length; i++) {
    const prev = ascending[i - 1]
    const cur = ascending[i]
    const gap = new Date(cur.graded_at).getTime() - new Date(prev.graded_at).getTime()
    if (cur.grade === prev.grade && gap < DOUBLE_CLICK_WINDOW_MS) dropped.add(cur)
  }
  return entries.filter(e => !dropped.has(e))
}

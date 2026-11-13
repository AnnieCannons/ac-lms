// Finding attempts that were never really taken in quiz_submissions.attempt_history.
//
// Until 2026-11-02 the quiz Submit button stayed live while the submission saved, and every extra
// click recorded another attempt. Those twins have a clear signature: no started_at (the first
// submit had already cleared the student's quiz_progress row), the same score as the attempt
// before, and a few seconds after it. A real retake always has a started_at, because opening the
// quiz form records one.

export type AttemptRecord = {
  attempt?: number
  started_at?: string | null
  submitted_at?: string | null
  score_percent?: number | null
}

/** Submits closer together than this, with nothing else to tell them apart, are one attempt. */
export const DUPLICATE_WINDOW_MS = 10_000

export function isDuplicateAttempt(prev: AttemptRecord, cur: AttemptRecord): boolean {
  if (cur.started_at != null) return false
  if (!prev.submitted_at || !cur.submitted_at) return false
  if ((cur.score_percent ?? null) !== (prev.score_percent ?? null)) return false
  const gap = new Date(cur.submitted_at).getTime() - new Date(prev.submitted_at).getTime()
  return gap >= 0 && gap < DUPLICATE_WINDOW_MS
}

/** The history with duplicate submits removed and attempts renumbered from 1. */
export function dedupeAttemptHistory(history: AttemptRecord[]): { history: AttemptRecord[]; removed: number } {
  const kept: AttemptRecord[] = []
  for (const h of history) {
    // Compare against the last kept attempt, so a run of five clicks collapses to one
    if (kept.length && isDuplicateAttempt(kept[kept.length - 1], h)) continue
    kept.push(h)
  }
  return {
    history: kept.map((h, i) => ({ ...h, attempt: i + 1 })),
    removed: history.length - kept.length,
  }
}

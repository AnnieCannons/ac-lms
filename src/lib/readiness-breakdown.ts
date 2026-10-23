// Pure readiness-score rules, shared by the Monday scoring job, the live
// "this week so far" preview, and their tests. No Supabase or Airtable here.

export type Zone = 'red' | 'yellow' | 'green'

/** The ?week= value for the staff Class Readiness live "this week so far" view. */
export const LIVE_WEEK = 'current'

/** Each full group of this many costs one point. Set directly by the program. */
export const READINESS_RULES = {
  blocksPerPoint: 2,
  missingPerPoint: 3,
  returnsPerPoint: 2,
} as const

/**
 * score = 5, minus 1 whole point per every full 2 blocks missed that week,
 * minus 1 whole point per every full 3 missing assignments, minus 1 whole
 * point per every full 2 times a submission was returned as Needs Revision
 * *during* that week (Mon-Sun, so weekend grading counts) -- every return counts (from grade_history), not just
 * whatever is still sitting in that state when this runs, so resubmitting
 * unfinished work just to clear the current-state count no longer helps.
 * Stepped, not continuous -- e.g. 1 needs-revision return costs nothing, 2
 * cost exactly 1 point, 3 still only cost 1 point. Weights and the 0-5 scale
 * were set directly by the program (student-accountability feature), not
 * inferred from data.
 */
export function computeReadinessScore(
  missingCount: number,
  needsRevisionCount: number,
  blocksMissed: number,
): number {
  const raw = 5
    - Math.floor(blocksMissed / READINESS_RULES.blocksPerPoint)
    - Math.floor(missingCount / READINESS_RULES.missingPerPoint)
    - Math.floor(needsRevisionCount / READINESS_RULES.returnsPerPoint)
  return Math.max(0, Math.min(5, raw))
}

export function zoneForScore(score: number): Zone {
  if (score >= 4) return 'green'
  if (score >= 2) return 'yellow'
  return 'red'
}

export type ReadinessFactor = {
  count: number
  perPoint: number
  pointsLost: number
  /** How many more would cost the next point. */
  untilNextPoint: number
}

export function readinessFactor(count: number, perPoint: number): ReadinessFactor {
  return {
    count,
    perPoint,
    pointsLost: Math.floor(count / perPoint),
    untilNextPoint: perPoint - (count % perPoint),
  }
}

/**
 * Missing work is counted live, so turning some in wins a point back: this is
 * how many to turn in for the next point back, or null when missing work isn't
 * costing anything.
 */
export function missingToRecoverPoint(missing: ReadinessFactor): number | null {
  return missing.pointsLost > 0 ? (missing.count % missing.perPoint) + 1 : null
}

export type ReadinessItem = {
  assignmentId: string
  title: string
  courseId: string
  /** Set only for an item from the TCF course that still counts in ITP. */
  priorCourseName: string | null
  dueDate: string | null
  /** For a needs-revision return: when it was returned. */
  returnedAt: string | null
}

export type ReadinessBreakdown = {
  score: number
  zone: Zone
  attendance: ReadinessFactor & { blocksTotal: number }
  missing: ReadinessFactor & { items: ReadinessItem[] }
  needsRevision: ReadinessFactor & { items: ReadinessItem[] }
}

export function buildReadinessBreakdown(input: {
  blocksMissed: number
  blocksTotal: number
  missing: ReadinessItem[]
  returns: ReadinessItem[]
}): ReadinessBreakdown {
  const score = computeReadinessScore(input.missing.length, input.returns.length, input.blocksMissed)
  return {
    score,
    zone: zoneForScore(score),
    attendance: { ...readinessFactor(input.blocksMissed, READINESS_RULES.blocksPerPoint), blocksTotal: input.blocksTotal },
    missing: { ...readinessFactor(input.missing.length, READINESS_RULES.missingPerPoint), items: input.missing },
    needsRevision: { ...readinessFactor(input.returns.length, READINESS_RULES.returnsPerPoint), items: input.returns },
  }
}

export type WeekRange = { start: string; end: string }

/** The Sunday ending the week that starts on this Monday ('YYYY-MM-DD'). */
export function sundayAfter(mondayStr: string): string {
  const d = new Date(`${mondayStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

/** The Monday a week's score is finalized on (the Monday after it starts). */
export function scoredOn(mondayStr: string): string {
  const d = new Date(`${mondayStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Which week the live preview shows: normally this week, but on a Monday
 * before the morning job has scored last week, last week -- so the preview
 * doesn't jump to an empty new week while last week's score is still pending.
 */
export function pickPreviewWeek(
  ranges: { thisWeek: WeekRange; lastWeek: WeekRange },
  todayEt: string,
  lastWeekScored: boolean,
): WeekRange {
  const isMonday = todayEt === ranges.thisWeek.start
  return isMonday && !lastWeekScored ? ranges.lastWeek : ranges.thisWeek
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** One line on what's costing points, e.g. "−1 attendance, −1 missing work" -- null when nothing is. */
export function summarizeLosses(b: ReadinessBreakdown): string | null {
  const parts = [
    b.attendance.pointsLost > 0 ? `−${b.attendance.pointsLost} attendance` : null,
    b.missing.pointsLost > 0 ? `−${b.missing.pointsLost} missing work` : null,
    b.needsRevision.pointsLost > 0 ? `−${b.needsRevision.pointsLost} returned for revision` : null,
  ].filter((p): p is string => !!p)
  return parts.length > 0 ? parts.join(', ') : null
}

export type ReadinessTips = { attendance: string | null; missing: string[]; needsRevision: string | null }

/**
 * Plain-language nudges for each part of the score. Worded to read the same
 * for the student and for staff. A warning about the next point is only given
 * while it can still happen (attendance through Thursday, returns through
 * Sunday), once at least one has happened, and while the score isn't already 0.
 */
export function readinessTips(
  b: ReadinessBreakdown,
  week: { end: string; returnsEnd: string },
  todayEt: string,
): ReadinessTips {
  const canDrop = b.score > 0
  const classOver = todayEt > week.end

  let attendance: string | null = null
  if (b.attendance.blocksTotal === 0) {
    attendance = classOver ? 'No attendance recorded for this week.' : 'No attendance recorded yet this week.'
  } else if (canDrop && !classOver && b.attendance.count > 0) {
    attendance = `${plural(b.attendance.untilNextPoint, 'more missed block', 'more missed blocks')} this week would cost ${b.attendance.pointsLost > 0 ? 'another' : 'a'} point.`
  }

  const missing: string[] = []
  const recover = missingToRecoverPoint(b.missing)
  if (recover != null) missing.push(`Turning in ${plural(recover, 'missing assignment', 'missing assignments')} would win back a point.`)
  if (canDrop && b.missing.count > 0) {
    missing.push(`${plural(b.missing.untilNextPoint, 'more assignment', 'more assignments')} going missing would cost ${b.missing.pointsLost > 0 ? 'another' : 'a'} point.`)
  }

  const needsRevision = canDrop && b.needsRevision.count > 0 && todayEt <= week.returnsEnd
    ? `${plural(b.needsRevision.untilNextPoint, 'more return', 'more returns')} for revision by Sunday would cost ${b.needsRevision.pointsLost > 0 ? 'another' : 'a'} point.`
    : null

  return { attendance, missing, needsRevision }
}

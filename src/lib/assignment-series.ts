// Pure rules for repeating assignments ("series") and the "I met my goal" check-off.
// No database access here, so it can be unit tested; the actions live in
// assignment-series-actions.ts.

import { pacificDate, pacificTime, pacificToUtcIso, addDays } from '@/lib/cutting-edge'

/** Where an assignment sits in the course outline. */
export type OutlinePosition = {
  id: string
  weekNumber: number | null
  moduleOrder: number
  dayOrder: number
  order: number
}

/** Sorts by course outline order: week, then module, then day, then position in the day. */
export function compareOutlinePosition(a: OutlinePosition, b: OutlinePosition): number {
  return (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
    || a.moduleOrder - b.moduleOrder
    || a.dayOrder - b.dayOrder
    || a.order - b.order
}

/**
 * The series members that come after `currentId` in the course outline — the ones a
 * confirmed goal excuses. The current assignment itself is never included.
 */
export function membersAfter<T extends OutlinePosition>(currentId: string, members: T[]): T[] {
  const current = members.find(m => m.id === currentId)
  if (!current) return []
  return members.filter(m => m.id !== currentId && compareOutlinePosition(m, current) > 0)
}

/**
 * Moves a due date by whole weeks, keeping the same Pacific wall-clock time across
 * daylight-saving changes (a Friday 11:59pm due date stays Friday 11:59pm).
 */
export function shiftDueDateByWeeks(dueDate: string | null, weeks: number): string | null {
  if (!dueDate) return null
  if (weeks === 0) return dueDate
  return pacificToUtcIso(addDays(pacificDate(dueDate), weeks * 7), pacificTime(dueDate))
}

/**
 * How many weeks apart two modules are, from their week numbers. Null when either module
 * has no week number, in which case a copy keeps no due date rather than a guessed one.
 */
export function weeksBetween(fromWeek: number | null, toWeek: number | null): number | null {
  if (fromWeek == null || toWeek == null) return null
  return toWeek - fromWeek
}

/** The due date a copy pushed into another week should get. */
export function copyDueDate(sourceDueDate: string | null, fromWeek: number | null, toWeek: number | null): string | null {
  const weeks = weeksBetween(fromWeek, toWeek)
  if (weeks == null) return null
  return shiftDueDateByWeeks(sourceDueDate, weeks)
}

/** Trims a goal check-off label; an empty one turns the check-off off. */
export function normalizeGoalLabel(label: string | null | undefined): string | null {
  const trimmed = (label ?? '').trim().slice(0, 200)
  return trimmed === '' ? null : trimmed
}

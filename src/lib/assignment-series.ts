// Pure rules for repeating assignments ("series") and the "I met my goal" check-off.
// No database access here, so it can be unit tested; the actions live in
// assignment-series-actions.ts.

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

// ── Due dates ──────────────────────────────────────────────────────────────────────────
// Due dates are stored as plain calendar dates (YYYY-MM-DD), so all of this is calendar
// arithmetic with no time zones.

const pad = (n: number) => String(n).padStart(2, '0')
const DAY_MS = 24 * 60 * 60 * 1000

function toUtc(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function fromUtc(t: number): string {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
export function addCalendarDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}
/** 0 = Sunday … 6 = Saturday. */
function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay()
}

const DAY_OFFSETS: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
}

/** Days after Monday for a day panel named after a weekday ("Tuesday" → 1); null otherwise. */
export function dayOffset(dayName: string): number | null {
  return DAY_OFFSETS[dayName.trim().toLowerCase()] ?? null
}

/**
 * The Monday of a course week. Week 1 is the week the course starts in, Monday-anchored,
 * the same as getCourseWeekNumber and modules.week_number.
 */
export function weekMonday(courseStart: string, weekNumber: number): string {
  const start = courseStart.slice(0, 10)
  const wd = weekday(start)
  const toMonday = wd === 0 ? -6 : 1 - wd
  return addCalendarDays(start, toMonday + (weekNumber - 1) * 7)
}

/** The calendar date of a weekday-named day in a course week, or null if it can't be known. */
export function classDate(courseStart: string | null, weekNumber: number | null, dayName: string): string | null {
  const offset = dayOffset(dayName)
  if (!courseStart || weekNumber == null || offset == null) return null
  return addCalendarDays(weekMonday(courseStart, weekNumber), offset)
}

/** A holiday or break: one day (end null) or an inclusive range. */
export type Closure = { label: string; start: string; end: string | null }

export function closureOn(date: string, closures: Closure[]): Closure | null {
  return closures.find(c => date >= c.start.slice(0, 10) && date <= (c.end ?? c.start).slice(0, 10)) ?? null
}

export type DefaultDueDate = {
  /** The day the assignment is on. */
  classDate: string
  dueDate: string
  /** Holidays/breaks skipped to reach the due date, and whether the class day itself is one. */
  skipped: Closure[]
  classDayClosure: Closure | null
}

/**
 * The default due date: the day after the assignment's day, moved forward past weekends,
 * holidays and breaks (so a Thursday assignment is due Friday, and a Friday one Monday).
 */
export function defaultDueDate(classDay: string, closures: Closure[]): DefaultDueDate {
  const skipped: Closure[] = []
  let due = addCalendarDays(classDay, 1)
  for (let guard = 0; guard < 120; guard++) {
    const wd = weekday(due)
    const closure = closureOn(due, closures)
    if (wd !== 0 && wd !== 6 && !closure) break
    if (closure && !skipped.includes(closure)) skipped.push(closure)
    due = addCalendarDays(due, 1)
  }
  return { classDate: classDay, dueDate: due, skipped, classDayClosure: closureOn(classDay, closures) }
}

/** Default due date for a week's day, or null when the week or day can't be placed on the calendar. */
export function defaultDueDateFor(
  courseStart: string | null, weekNumber: number | null, dayName: string, closures: Closure[],
): DefaultDueDate | null {
  const day = classDate(courseStart, weekNumber, dayName)
  return day ? defaultDueDate(day, closures) : null
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export type WeekPlacement =
  | {
      kind: 'placed'
      /** The day panel the copy goes on (the original day, or the day it moved to). */
      dayName: string
      due: DefaultDueDate
      /** Set when the original day was a holiday and the copy moved off it. */
      movedFrom: { dayName: string; date: string; closure: Closure } | null
    }
  | { kind: 'skipped'; closure: Closure }

/**
 * Where a repeating assignment's copy goes in a given week. Normally its usual day. If that
 * day is a holiday, it moves to the closest open weekday before it in the same week (e.g. a
 * Thursday on Thanksgiving moves to Wednesday); if nothing earlier is open, the closest open
 * day after it in the same week; if the whole week is closed (a break), the week is skipped.
 * Null when the week or day can't be placed on the calendar.
 */
export function placeInWeek(
  courseStart: string | null, weekNumber: number | null, dayName: string, closures: Closure[],
): WeekPlacement | null {
  const usual = classDate(courseStart, weekNumber, dayName)
  if (!usual || !courseStart || weekNumber == null) return null
  const closure = closureOn(usual, closures)
  if (!closure) return { kind: 'placed', dayName, due: defaultDueDate(usual, closures), movedFrom: null }

  const offset = dayOffset(dayName)!
  const monday = weekMonday(courseStart, weekNumber)
  const candidates = [
    ...Array.from({ length: Math.min(offset, 5) }, (_, i) => Math.min(offset, 5) - 1 - i), // earlier, nearest first
    ...Array.from({ length: 5 }, (_, i) => i).filter(i => i > offset),                      // later, nearest first
  ]
  for (const i of candidates) {
    const date = addCalendarDays(monday, i)
    if (!closureOn(date, closures)) {
      return {
        kind: 'placed',
        dayName: WEEKDAY_NAMES[i],
        due: defaultDueDate(date, closures),
        movedFrom: { dayName, date: usual, closure },
      }
    }
  }
  return { kind: 'skipped', closure }
}

/** Moves a stored due date by whole weeks (fallback when a week isn't on the calendar). */
export function shiftDueDateByWeeks(dueDate: string | null, weeks: number): string | null {
  if (!dueDate) return null
  return addCalendarDays(dueDate.slice(0, 10), weeks * 7)
}

/**
 * How many weeks apart two modules are, from their week numbers. Null when either module
 * has no week number.
 */
export function weeksBetween(fromWeek: number | null, toWeek: number | null): number | null {
  if (fromWeek == null || toWeek == null) return null
  return toWeek - fromWeek
}

/**
 * The due date for a copy in another week: the calendar default (day after its day, past
 * holidays) when the course calendar allows it, otherwise the source's due date moved by
 * the week gap, otherwise none.
 */
export function copyDueDate(args: {
  courseStart: string | null
  closures: Closure[]
  dayName: string
  sourceDueDate: string | null
  fromWeek: number | null
  toWeek: number | null
}): string | null {
  const calendar = defaultDueDateFor(args.courseStart, args.toWeek, args.dayName, args.closures)
  if (calendar) return calendar.dueDate
  const weeks = weeksBetween(args.fromWeek, args.toWeek)
  if (weeks == null) return null
  return shiftDueDateByWeeks(args.sourceDueDate, weeks)
}

/** Trims a goal check-off label; an empty one turns the check-off off. */
export function normalizeGoalLabel(label: string | null | undefined): string | null {
  const trimmed = (label ?? '').trim().slice(0, 200)
  return trimmed === '' ? null : trimmed
}

// ── Which modules are course weeks ──────────────────────────────────────────────────────

export type WeekCandidate = { id: string; title: string | null; week_number: number | null; order: number; published?: boolean | null }

const titleWeek = (title: string | null) => {
  const m = title?.trim().match(/^Week\s+(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

/**
 * The modules that are real course weeks, in week order: they need a week number, and when
 * several modules share one (e.g. a stray "Extra?" module also saved as week 1), the one
 * whose title says "Week N" wins. Modules titled "DO NOT PUBLISH" are never weeks.
 */
export function courseWeeks<T extends WeekCandidate>(modules: T[]): T[] {
  const candidates = modules.filter(m => m.week_number != null && m.title && !m.title.includes('DO NOT PUBLISH'))
  const byWeek = new Map<number, T[]>()
  for (const m of candidates) byWeek.set(m.week_number!, [...(byWeek.get(m.week_number!) ?? []), m])
  const weeks: T[] = []
  for (const group of byWeek.values()) {
    const titled = group.filter(m => titleWeek(m.title) === m.week_number)
    weeks.push(...(titled.length > 0 ? titled : group))
  }
  return weeks.sort((a, b) => a.week_number! - b.week_number! || a.order - b.order)
}

/** The day name most copies of a series sit on (its usual day, ignoring holiday moves). */
export function usualDayName(dayNames: string[]): string {
  const counts = new Map<string, number>()
  for (const d of dayNames) counts.set(d, (counts.get(d) ?? 0) + 1)
  let best = ''
  let bestCount = 0
  for (const [d, c] of counts) if (c > bestCount) { best = d; bestCount = c }
  return best
}

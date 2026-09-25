/**
 * Parse a YYYY-MM-DD date string as a local date (no UTC interpretation).
 * Uses Date(year, month, day) constructor which always uses local timezone.
 * Always uses only the first 10 characters so it works with both plain
 * YYYY-MM-DD strings and legacy ISO timestamps stored in the DB.
 */
export function localDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Midnight of today in local time — use for "is past due?" comparisons
 * so that an assignment is only considered late the DAY AFTER it's due,
 * not on the due date itself.
 */
export function todayLocal(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/**
 * True if dueDate is unset, or falls within the next `days` days from today
 * (inclusive). Used to keep "Not Started" scoped to assignments that are
 * actually coming up, rather than everything unsubmitted in the whole course.
 */
export function isDueSoon(dueDate: string | null | undefined, days = 7): boolean {
  if (!dueDate) return true
  const cutoff = todayLocal()
  cutoff.setDate(cutoff.getDate() + days)
  return localDate(dueDate) <= cutoff
}

/**
 * True if dueDate is unset, or falls within the Mon-Sun calendar week
 * containing today. Used to scope "Due this week" to the current week
 * rather than a rolling window.
 */
export function isDueThisWeek(dueDate: string | null | undefined): boolean {
  if (!dueDate) return true
  const today = todayLocal()
  const day = today.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const due = localDate(dueDate)
  return due >= monday && due <= sunday
}

/**
 * Course week number for "today", anchored to Mon-Sun calendar weeks
 * starting from the Monday on/before the course's start date. Without this
 * anchoring, a mid-week start date drifts week boundaries away from Monday
 * (e.g. a Tuesday start makes "week 2" begin on a Tuesday instead of the
 * following Monday), which disagrees with the Monday-Thursday day structure
 * shown elsewhere in the course outline.
 * Returns null if the course hasn't started yet, or (when endDate is given)
 * has already ended.
 */
export function getCourseWeekNumber(
  startDate: string | null | undefined,
  endDate?: string | null,
): number | null {
  if (!startDate) return null
  const start = localDate(startDate)
  const today = todayLocal()
  if (endDate && today > localDate(endDate)) return null
  if (today < start) return null
  const startDay = start.getDay()
  const diffToMonday = startDay === 0 ? -6 : 1 - startDay
  const anchorMonday = new Date(start)
  anchorMonday.setDate(start.getDate() + diffToMonday)
  const diffDays = Math.floor((today.getTime() - anchorMonday.getTime()) / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

export function formatDueDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
  locale = 'en-US',
): string {
  return localDate(dateStr).toLocaleDateString(locale, options)
}

export function formatDueDateWithTime(dateStr: string): string {
  return `${formatDueDate(dateStr)}, 11:59pm`
}

/**
 * Returns true if the submission timestamp is after 11:59:59pm on dueDate
 * in the student's IANA timezone (e.g. "America/New_York").
 *
 * Method: we find the UTC offset at noon on the due date (noon avoids DST
 * edge cases), then shift the naive "dueDate 23:59:59 UTC" by that offset
 * to get the real UTC deadline.
 */
export function isLateInTimezone(
  submittedAt: string,
  dueDate: string | null,
  tz: string | null,
): boolean {
  if (!dueDate || !tz) return false
  try {
    const noonUTC = new Date(`${dueDate}T12:00:00Z`)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(noonUTC)
    const h = parseInt(parts.find(p => p.type === 'hour')!.value)
    const m = parseInt(parts.find(p => p.type === 'minute')!.value)
    const s = parseInt(parts.find(p => p.type === 'second')!.value)
    // UTC offset in seconds: how many seconds ahead UTC is of local at noon
    const offsetSecs = 12 * 3600 - (h * 3600 + m * 60 + s)
    // Deadline UTC = treat "dueDate 23:59:59" as naive local time, add offset
    const deadlineUTC = new Date(new Date(`${dueDate}T23:59:59Z`).getTime() + offsetSecs * 1000)
    return new Date(submittedAt) > deadlineUTC
  } catch {
    return false
  }
}

/**
 * True once an optional assignment's due date has passed and it should stop
 * taking submissions. Without the student's timezone we fall back to the
 * latest timezone on earth (UTC-12), so we never close anything early.
 */
export function isOptionalClosed(dueDate: string | null | undefined, tz?: string | null): boolean {
  if (!dueDate) return false
  return isLateInTimezone(new Date().toISOString(), dueDate.slice(0, 10), tz || 'Etc/GMT+12')
}

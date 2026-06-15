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

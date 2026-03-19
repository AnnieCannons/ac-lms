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

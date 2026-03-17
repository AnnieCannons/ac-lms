/**
 * Parse a YYYY-MM-DD date string as a local date (no UTC interpretation).
 * Uses Date(year, month, day) constructor which always uses local timezone.
 */
export function localDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDueDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
  locale = 'en-US',
): string {
  return localDate(dateStr).toLocaleDateString(locale, options)
}

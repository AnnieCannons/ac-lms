/**
 * Parse a YYYY-MM-DD date string as local noon to avoid UTC-to-local timezone shifts
 * that cause "2026-03-20" to display as Mar 19 in negative-offset timezones.
 */
export function localDate(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T12:00:00`)
}

export function formatDueDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
  locale = 'en-US',
): string {
  return localDate(dateStr).toLocaleDateString(locale, options)
}

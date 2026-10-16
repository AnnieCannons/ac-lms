// A module's week_number is what the app uses to place it on the calendar
// ("Current Week", quiz pinning, the "Week N this week" link). Its title is what
// people read. When the title starts with "Week N" and the saved week_number is
// a different number, they've drifted — usually after copying a course whose
// schedule had a career/break week in a different place.

export function weekFromTitle(title: string | null | undefined): number | null {
  const match = title?.trim().match(/^Week\s+(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

// Returns the title's week number when it disagrees with the saved week_number,
// otherwise null. A null week_number means "not on the calendar" (e.g. a
// placeholder for a career week this cohort doesn't have) and isn't flagged.
export function titleWeekMismatch(title: string | null | undefined, weekNumber: number | null | undefined): number | null {
  if (weekNumber == null) return null
  const titleWeek = weekFromTitle(title)
  return titleWeek !== null && titleWeek !== weekNumber ? titleWeek : null
}

// Pure helpers for the Class Readiness page -- no Supabase access, so they can
// be unit-tested directly (readiness-actions.ts is 'use server' and can't be).

import type { Zone } from '@/lib/readiness'

/** Lowercased email with any "+tag" dropped from the local part: rai+1@x.com -> rai@x.com. */
export function normalizeEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split('@')
  if (!domain) return local
  return `${local.split('+')[0]}@${domain}`
}

/**
 * A student-enrolled account is a staff tester when its email, ignoring any
 * "+tag", matches a staff/instructor/admin user's email -- e.g. rai+1@... is
 * Rai's test student.
 */
export function isTesterEmail(email: string | null | undefined, staffEmails: Set<string>): boolean {
  if (!email) return false
  return staffEmails.has(normalizeEmail(email))
}

export type WeekStats = {
  score: number | null
  zone: Zone | null
  missing: number
  needsRevision: number
  blocksMissed: number | null
  blocksTotal: number | null
}

export type ClassAverages = {
  /** Students with a snapshot this week -- the denominator for score/missing/needs revision. */
  studentCount: number
  score: number | null
  missing: number | null
  needsRevision: number | null
  /** Averaged only over students with attendance data (blocksTotal > 0). */
  blocksMissed: number | null
  blocksTotal: number | null
  zoneCounts: Record<Zone, number>
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

/** Class-wide averages for one week. Pass only students who have a snapshot that week. */
export function computeClassAverages(weeks: WeekStats[]): ClassAverages {
  const zoneCounts: Record<Zone, number> = { red: 0, yellow: 0, green: 0 }
  for (const w of weeks) if (w.zone) zoneCounts[w.zone]++

  // A 0-block week means no Airtable attendance match, not perfect attendance.
  const withAttendance = weeks.filter(w => (w.blocksTotal ?? 0) > 0)

  return {
    studentCount: weeks.length,
    score: mean(weeks.flatMap(w => (w.score != null ? [w.score] : []))),
    missing: mean(weeks.map(w => w.missing)),
    needsRevision: mean(weeks.map(w => w.needsRevision)),
    blocksMissed: mean(withAttendance.map(w => w.blocksMissed ?? 0)),
    blocksTotal: mean(withAttendance.map(w => w.blocksTotal ?? 0)),
    zoneCounts,
  }
}

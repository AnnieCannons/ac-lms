// Pure rules for New Student Onboarding (Enrollment Readiness courses). No database access.
// See _plans/new-student-onboarding-roadmap.md.

import { getAssignmentStatus } from '@/lib/assignment-status'

/** Student sidebar sections an Enrollment Readiness course leaves out (their pages redirect to the outline). */
export const ENROLLMENT_READINESS_HIDDEN_SECTIONS = [
  'info',
  'cutting-edge-talks',
  'class-resources',
  'career',
  'level-up',
  'quizzes',
] as const

/** Shown on the congratulations card once a student has finished. */
export const ONBOARDING_PRACTICE_LINKS = [
  { title: 'Learn HTML', url: 'https://www.codecademy.com/learn/learn-html' },
  { title: 'Learn CSS', url: 'https://www.codecademy.com/learn/learn-css' },
  { title: 'Learn JavaScript', url: 'https://www.codecademy.com/learn/introduction-to-javascript' },
] as const

export type OnboardingAssignment = {
  id: string
  title: string
  due_date: string | null
  submission_required: boolean | null
  counts_toward_onboarding: boolean | null
  is_optional: boolean | null
  is_bonus: boolean | null
}

export type OnboardingSubmission = {
  id: string
  assignment_id: string
  status: 'draft' | 'submitted' | 'graded' | null
  grade: 'complete' | 'incomplete' | null
}

export type OnboardingOverride = { due_date: string | null; excused: boolean }

/**
 * Where one assignment stands for one student, from staff's point of view:
 * - `turned_in`: submitted, waiting for staff to mark it Complete
 * - `check_off`: a "No submission" assignment staff haven't marked yet
 */
export type OnboardingItemStatus = 'complete' | 'excused' | 'needs_revision' | 'turned_in' | 'check_off' | 'not_started'

export const ONBOARDING_STATUS_LABELS: Record<OnboardingItemStatus, string> = {
  complete: 'Complete',
  excused: 'Excused',
  needs_revision: 'Needs revision',
  turned_in: 'Turned in, needs marking',
  check_off: 'Staff check-off',
  not_started: 'Not started',
}

/** Optional and bonus work never counts, nor anything set to "Doesn't count toward finishing". */
export function countsTowardFinishing(a: Pick<OnboardingAssignment, 'counts_toward_onboarding' | 'is_optional' | 'is_bonus'>): boolean {
  return a.counts_toward_onboarding !== false && !a.is_optional && !a.is_bonus
}

export function onboardingItemStatus(
  a: Pick<OnboardingAssignment, 'submission_required'>,
  sub: Pick<OnboardingSubmission, 'status' | 'grade'> | undefined,
  override: OnboardingOverride | undefined,
): OnboardingItemStatus {
  // The same Complete / Needs revision / Turned in / Excused rules students see everywhere else.
  const { kind } = getAssignmentStatus({ status: sub?.status ?? null, grade: sub?.grade ?? null, excused: !!override?.excused })
  if (kind === 'complete') return 'complete'
  if (kind === 'excused') return 'excused'
  if (kind === 'needs-revision') return 'needs_revision'
  // A "No submission" assignment only ever has the placeholder staff create, so anything
  // short of Complete is still waiting on staff.
  if (a.submission_required === false) return 'check_off'
  if (kind === 'turned-in') return 'turned_in'
  return 'not_started'
}

export type OnboardingItem = {
  assignment: OnboardingAssignment
  status: OnboardingItemStatus
  /** Counts toward finishing (see countsTowardFinishing) */
  counts: boolean
  /** The student's own due date (their extension, if any) */
  dueDate: string | null
  /** Still to do and its due date has passed (date-only compare in the given "today") */
  overdue: boolean
  submissionId: string | null
}

export type OnboardingProgress = {
  items: OnboardingItem[]
  /** Counted assignments that aren't excused */
  total: number
  /** Counted assignments marked Complete */
  done: number
  /** Counted work waiting on staff (turned in, or a check-off) */
  toMark: number
  needsRevision: number
  notStarted: number
  overdue: number
  finished: boolean
}

/**
 * A student's progress through an Enrollment Readiness course. `assignments` are the
 * course's published assignments in outline order; `today` is a YYYY-MM-DD date.
 * Finished = at least one counted assignment and every counted one Complete (or excused).
 */
export function onboardingProgress(
  assignments: OnboardingAssignment[],
  submissions: Map<string, OnboardingSubmission>,
  overrides: Map<string, OnboardingOverride>,
  today: string,
): OnboardingProgress {
  const items: OnboardingItem[] = assignments.map(a => {
    const sub = submissions.get(a.id)
    const override = overrides.get(a.id)
    const status = onboardingItemStatus(a, sub, override)
    const dueDate = override?.due_date ?? a.due_date
    const outstanding = status !== 'complete' && status !== 'excused'
    return {
      assignment: a,
      status,
      counts: countsTowardFinishing(a),
      dueDate,
      overdue: outstanding && !!dueDate && dueDate.slice(0, 10) < today,
      submissionId: sub?.id ?? null,
    }
  })
  const counted = items.filter(i => i.counts)
  const required = counted.filter(i => i.status !== 'excused')
  const done = required.filter(i => i.status === 'complete').length
  return {
    items,
    total: required.length,
    done,
    toMark: required.filter(i => i.status === 'turned_in' || i.status === 'check_off').length,
    needsRevision: required.filter(i => i.status === 'needs_revision').length,
    notStarted: required.filter(i => i.status === 'not_started').length,
    overdue: required.filter(i => i.overdue).length,
    finished: counted.length > 0 && done === required.length,
  }
}

// ── Cohorts ──────────────────────────────────────────────────────────────────

export type CohortCourse = { id: string; name: string; start_date: string | null; end_date: string | null }

/**
 * Which Enrollment Readiness course the onboarding page opens on: the one running today
 * (latest start), else the next to start, else the most recent. `today` is YYYY-MM-DD.
 */
export function pickDefaultCohort<T extends CohortCourse>(courses: T[], today: string): T | null {
  if (courses.length === 0) return null
  const start = (c: T) => c.start_date?.slice(0, 10) ?? ''
  const end = (c: T) => c.end_date?.slice(0, 10) ?? '9999-12-31'
  const running = courses.filter(c => start(c) && start(c) <= today && today <= end(c))
  if (running.length) return [...running].sort((a, b) => start(b).localeCompare(start(a)))[0]
  const upcoming = courses.filter(c => start(c) > today)
  if (upcoming.length) return [...upcoming].sort((a, b) => start(a).localeCompare(start(b)))[0]
  return [...courses].sort((a, b) => start(b).localeCompare(start(a)))[0]
}

/** Current and upcoming cohorts first (soonest start first), then past ones (most recent first). */
export function sortCohorts<T extends CohortCourse>(courses: T[], today: string): T[] {
  const end = (c: T) => c.end_date?.slice(0, 10) ?? '9999-12-31'
  const start = (c: T) => c.start_date?.slice(0, 10) ?? ''
  const live = courses.filter(c => end(c) >= today).sort((a, b) => start(a).localeCompare(start(b)))
  const past = courses.filter(c => end(c) < today).sort((a, b) => start(b).localeCompare(start(a)))
  return [...live, ...past]
}

/** Where a student is in onboarding, for the page's filters. */
export type OnboardingStage = 'invited' | 'in_progress' | 'done' | 'moved_on'

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  invited: 'Invited',
  in_progress: 'In progress',
  done: 'Done',
  moved_on: 'Moved on',
}

export function onboardingStage(finished: boolean, inNextCourse: boolean): Exclude<OnboardingStage, 'invited'> {
  if (inNextCourse) return 'moved_on'
  return finished ? 'done' : 'in_progress'
}

// ── Finishing ────────────────────────────────────────────────────────────────

/** hardware_alerts_sent key: the waitlist add and #student-hardware post happen once per student per course. */
export function onboardingFinishedKey(courseId: string, studentId: string): string {
  return `onboarding-finished:${courseId}:${studentId}`
}

/** The equipment a finished student is waiting for, in words ("a laptop and a hotspot"). */
export function describeNeeds(kinds: string[]): string {
  const words = kinds.map(k => (k === 'laptop' ? 'a laptop' : k === 'hotspot' ? 'a hotspot' : k === 'booster' ? 'a wifi booster' : k === 'comcast_now' ? 'Comcast NOW' : k))
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

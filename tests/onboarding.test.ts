import { describe, it, expect } from 'vitest'
import {
  countsTowardFinishing,
  describeNeeds,
  onboardingItemStatus,
  onboardingProgress,
  onboardingStage,
  pickDefaultCohort,
  sortCohorts,
  type OnboardingAssignment,
  type OnboardingOverride,
  type OnboardingSubmission,
} from '@/lib/onboarding'

const asg = (id: string, extra: Partial<OnboardingAssignment> = {}): OnboardingAssignment => ({
  id, title: id, due_date: '2026-12-11', submission_required: true,
  counts_toward_onboarding: true, is_optional: false, is_bonus: false, ...extra,
})
const sub = (assignment_id: string, status: OnboardingSubmission['status'], grade: OnboardingSubmission['grade'] = null): OnboardingSubmission =>
  ({ id: `s-${assignment_id}`, assignment_id, status, grade })

describe('countsTowardFinishing', () => {
  it('counts ordinary assignments, and ones saved before the setting existed', () => {
    expect(countsTowardFinishing(asg('a'))).toBe(true)
    expect(countsTowardFinishing(asg('a', { counts_toward_onboarding: null }))).toBe(true)
  })
  it('never counts optional, bonus or "doesn’t count" work', () => {
    expect(countsTowardFinishing(asg('a', { is_optional: true }))).toBe(false)
    expect(countsTowardFinishing(asg('a', { is_bonus: true }))).toBe(false)
    expect(countsTowardFinishing(asg('a', { counts_toward_onboarding: false }))).toBe(false)
  })
})

describe('onboardingItemStatus', () => {
  const a = asg('a')
  it('follows the usual Complete / Needs revision / Turned in rules', () => {
    expect(onboardingItemStatus(a, sub('a', 'graded', 'complete'), undefined)).toBe('complete')
    expect(onboardingItemStatus(a, sub('a', 'graded', 'incomplete'), undefined)).toBe('needs_revision')
    expect(onboardingItemStatus(a, sub('a', 'submitted'), undefined)).toBe('turned_in')
    expect(onboardingItemStatus(a, sub('a', 'draft'), undefined)).toBe('not_started')
    expect(onboardingItemStatus(a, undefined, undefined)).toBe('not_started')
  })
  it('treats excused work as excused, whether or not anything was turned in', () => {
    expect(onboardingItemStatus(a, undefined, { due_date: null, excused: true })).toBe('excused')
    expect(onboardingItemStatus(a, sub('a', 'submitted'), { due_date: null, excused: true })).toBe('excused')
  })
  it('a "No submission" assignment waits on staff until it is marked Complete', () => {
    const checkOff = asg('c', { submission_required: false })
    expect(onboardingItemStatus(checkOff, undefined, undefined)).toBe('check_off')
    // the placeholder staff create when they unmark it
    expect(onboardingItemStatus(checkOff, sub('c', 'submitted'), undefined)).toBe('check_off')
    expect(onboardingItemStatus(checkOff, sub('c', 'graded', 'complete'), undefined)).toBe('complete')
  })
})

describe('onboardingProgress', () => {
  const assignments = [
    asg('checklist', { due_date: '2026-11-30' }),
    asg('agreement'),
    asg('calendar'),
    asg('receiving', { counts_toward_onboarding: false, due_date: '2027-01-08' }),
    asg('extra', { is_optional: true }),
  ]

  it('counts only what counts, and needs every counted one Complete', () => {
    const subs = new Map([
      ['checklist', sub('checklist', 'graded', 'complete')],
      ['agreement', sub('agreement', 'submitted')],
      ['calendar', sub('calendar', 'graded', 'incomplete')],
    ])
    const p = onboardingProgress(assignments, subs, new Map(), '2026-12-01')
    expect(p).toMatchObject({ total: 3, done: 1, toMark: 1, needsRevision: 1, notStarted: 0, finished: false })
    expect(p.items).toHaveLength(5)
    expect(p.items.find(i => i.assignment.id === 'receiving')?.counts).toBe(false)
  })

  it('is finished once every counted assignment is Complete, whatever happens to the rest', () => {
    const subs = new Map(['checklist', 'agreement', 'calendar'].map(id => [id, sub(id, 'graded', 'complete')] as const))
    const p = onboardingProgress(assignments, subs, new Map(), '2026-12-20')
    expect(p).toMatchObject({ total: 3, done: 3, finished: true, overdue: 0 })
  })

  it('submitted is not enough', () => {
    const subs = new Map(['checklist', 'agreement', 'calendar'].map(id => [id, sub(id, 'submitted')] as const))
    expect(onboardingProgress(assignments, subs, new Map(), '2026-12-01')).toMatchObject({ done: 0, toMark: 3, finished: false })
  })

  it('leaves excused work out of the total', () => {
    const subs = new Map(['checklist', 'agreement'].map(id => [id, sub(id, 'graded', 'complete')] as const))
    const overrides = new Map<string, OnboardingOverride>([['calendar', { due_date: null, excused: true }]])
    expect(onboardingProgress(assignments, subs, overrides, '2026-12-01')).toMatchObject({ total: 2, done: 2, finished: true })
  })

  it('is finished when everything counted is excused, but never for a course with nothing counted', () => {
    const overrides = new Map<string, OnboardingOverride>(['checklist', 'agreement', 'calendar'].map(id => [id, { due_date: null, excused: true }]))
    expect(onboardingProgress(assignments, new Map(), overrides, '2026-12-01').finished).toBe(true)
    expect(onboardingProgress([asg('x', { counts_toward_onboarding: false })], new Map(), new Map(), '2026-12-01').finished).toBe(false)
    expect(onboardingProgress([], new Map(), new Map(), '2026-12-01').finished).toBe(false)
  })

  it('flags overdue work using the student’s own due date', () => {
    const overrides = new Map<string, OnboardingOverride>([['checklist', { due_date: '2026-12-15', excused: false }]])
    const p = onboardingProgress(assignments, new Map(), overrides, '2026-12-12')
    // agreement and calendar were due 12/11; checklist was extended to 12/15
    expect(p.overdue).toBe(2)
    expect(p.items.find(i => i.assignment.id === 'checklist')).toMatchObject({ dueDate: '2026-12-15', overdue: false })
  })

  it('never flags finished work, or work waiting on staff, as overdue', () => {
    const subs = new Map([
      ['checklist', sub('checklist', 'graded', 'complete')],
      ['agreement', sub('agreement', 'submitted')],
      ['calendar', sub('calendar', 'graded', 'incomplete')],
    ])
    const p = onboardingProgress([...assignments, asg('office', { submission_required: false })], subs, new Map(), '2027-02-01')
    const overdue = Object.fromEntries(p.items.map(i => [i.assignment.id, i.overdue]))
    // only Needs revision is still on the student
    expect(overdue).toMatchObject({ checklist: false, agreement: false, calendar: true, office: false })
    expect(p.overdue).toBe(1)
  })
})

describe('cohorts', () => {
  const er = (id: string, start: string, end: string) => ({ id, name: id, start_date: start, end_date: end })
  const courses = [er('aug', '2026-08-10', '2026-09-07'), er('nov', '2026-11-27', '2026-12-25'), er('apr', '2027-04-01', '2027-04-30')]

  it('opens on the cohort running today, else the next one, else the latest', () => {
    expect(pickDefaultCohort(courses, '2026-12-01')?.id).toBe('nov')
    expect(pickDefaultCohort(courses, '2027-01-15')?.id).toBe('apr')
    expect(pickDefaultCohort(courses, '2027-06-01')?.id).toBe('apr')
    expect(pickDefaultCohort([], '2027-06-01')).toBeNull()
  })

  it('lists current and upcoming cohorts first, then past ones newest first', () => {
    expect(sortCohorts(courses, '2026-12-01').map(c => c.id)).toEqual(['nov', 'apr', 'aug'])
  })
})

describe('onboardingStage', () => {
  it('moved on beats done beats in progress', () => {
    expect(onboardingStage(false, false)).toBe('in_progress')
    expect(onboardingStage(true, false)).toBe('done')
    expect(onboardingStage(true, true)).toBe('moved_on')
  })
})

describe('describeNeeds', () => {
  it('reads naturally', () => {
    expect(describeNeeds(['laptop'])).toBe('a laptop')
    expect(describeNeeds(['laptop', 'hotspot'])).toBe('a laptop and a hotspot')
    expect(describeNeeds(['laptop', 'booster', 'comcast_now'])).toBe('a laptop, a wifi booster and Comcast NOW')
    expect(describeNeeds([])).toBe('')
  })
})

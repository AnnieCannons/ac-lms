import { describe, it, expect } from 'vitest'
import {
  absenceWindow,
  absentBlocks,
  catchUpPath,
  describeAbsence,
  formatBlocks,
  instructorFollowUpMessage,
  isDateParam,
  pickCourseForAbsence,
  studentAbsenceMessage,
  validateCatchUpInput,
} from '@/lib/class-catch-up'

const filled = {
  missedBlocks: 'Blocks C and D on Wednesday, October 21',
  lecturesMissed: 'Async JS',
  lectureLinks: 'https://example.com/rec',
  assignmentsMissed: 'Promises lab',
  makeupPlan: 'Watch by Friday',
  notes: '',
}

describe('absenceWindow', () => {
  it('covers the three days before today in Pacific time', () => {
    // 5:10am PDT on Thursday Oct 22 2026 is 12:10 UTC
    expect(absenceWindow(new Date('2026-10-22T12:10:00Z'))).toEqual({ since: '2026-10-19', until: '2026-10-21' })
  })

  it('reaches back to Friday on a Monday', () => {
    expect(absenceWindow(new Date('2026-10-26T12:10:00Z'))).toEqual({ since: '2026-10-23', until: '2026-10-25' })
  })
})

describe('absentBlocks / formatBlocks / describeAbsence', () => {
  it('picks only Absent blocks (not Tardy or Present)', () => {
    expect(absentBlocks({ blockA: 'Present', blockB: 'Absent', blockC: 'Tardy', blockD: 'Absent - excused' })).toEqual(['B', 'D'])
    expect(absentBlocks({ blockA: null, blockB: null, blockC: null, blockD: null })).toEqual([])
  })

  it('reads naturally', () => {
    expect(formatBlocks(['A'])).toBe('Block A')
    expect(formatBlocks(['D', 'C'])).toBe('Blocks C and D')
    expect(formatBlocks(['A', 'B', 'D', 'B'])).toBe('Blocks A, B and D')
    expect(describeAbsence('2026-10-21', ['C', 'D'])).toBe('Blocks C and D on Wednesday, October 21')
    expect(describeAbsence('2026-10-21', [])).toBe('Wednesday, October 21')
  })
})

describe('isDateParam', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isDateParam('2026-10-21')).toBe(true)
    expect(isDateParam('2026-02-30')).toBe(false)
    expect(isDateParam('2026-10-21T00:00')).toBe(false)
    expect(isDateParam("'; drop")).toBe(false)
    expect(isDateParam(undefined)).toBe(false)
  })
})

describe('pickCourseForAbsence', () => {
  const tcf = { id: 'tcf', start_date: '2026-08-01', end_date: '2026-10-20' }
  const itp = { id: 'itp', start_date: '2026-10-19', end_date: null }
  it('uses the course running that day', () => {
    expect(pickCourseForAbsence([tcf, itp], '2026-10-10')).toBe('tcf')
    expect(pickCourseForAbsence([tcf, itp], '2026-10-21')).toBe('itp')
  })
  it('prefers the newer course when two overlap', () => {
    expect(pickCourseForAbsence([tcf, itp], '2026-10-19')).toBe('itp')
  })
  it('returns null when no course is running', () => {
    expect(pickCourseForAbsence([tcf], '2027-01-05')).toBeNull()
    expect(pickCourseForAbsence([{ id: 'x', start_date: null, end_date: null }], '2026-10-21')).toBeNull()
  })
})

describe('validateCatchUpInput', () => {
  it('trims and accepts a filled-in form, with empty notes as null', () => {
    const r = validateCatchUpInput({ ...filled, makeupPlan: '  Watch by Friday  ' })
    expect(r).toEqual({ value: { ...filled, notes: null } })
  })

  it.each(['missedBlocks', 'lecturesMissed', 'lectureLinks', 'assignmentsMissed', 'makeupPlan'] as const)('requires %s', key => {
    expect(validateCatchUpInput({ ...filled, [key]: '   ' })).toHaveProperty('error')
  })

  it('caps length', () => {
    expect(validateCatchUpInput({ ...filled, notes: 'x'.repeat(5001) })).toHaveProperty('error')
  })
})

describe('Slack messages', () => {
  it('links the student to the form for that day and escapes their name', () => {
    const msg = studentAbsenceMessage('<!channel> Ana', '2026-10-21', ['A'], 'https://lms/x')
    expect(msg).toContain('&lt;!channel&gt;')
    expect(msg).toContain('Block A on Wednesday, October 21')
    expect(msg).toContain('https://lms/x')
    expect(catchUpPath('c1', '2026-10-21')).toBe('/student/courses/c1/catch-up?date=2026-10-21')
    expect(catchUpPath('c1')).toBe('/student/courses/c1/catch-up')
  })

  it('asks the instructor to follow up, escaping student text', () => {
    const msg = instructorFollowUpMessage('Ana', 'ITP', { missedBlocks: 'Block A', makeupPlan: '<https://evil|click>' }, 'https://lms/i')
    expect(msg).toContain('Please follow up')
    expect(msg).toContain('&lt;https://evil|click&gt;')
    expect(msg).toContain('https://lms/i')
  })
})

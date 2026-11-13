import { describe, it, expect } from 'vitest'
import {
  compareOutlinePosition, membersAfter, shiftDueDateByWeeks, copyDueDate, weeksBetween, normalizeGoalLabel,
  weekMonday, classDate, defaultDueDate, defaultDueDateFor, placeInWeek, courseWeeks, usualDayName,
  type OutlinePosition,
} from '@/lib/assignment-series'

const pos = (id: string, weekNumber: number | null, over: Partial<OutlinePosition> = {}): OutlinePosition => ({
  id, weekNumber, moduleOrder: weekNumber ?? 0, dayOrder: 0, order: 0, ...over,
})

describe('membersAfter', () => {
  const series = [pos('w3', 3), pos('w1', 1), pos('w2', 2), pos('w4', 4)]

  it('returns only the weeks after the current one, never the current one', () => {
    expect(membersAfter('w2', series).map(m => m.id).sort()).toEqual(['w3', 'w4'])
  })

  it('returns nothing for the last week or an unknown id', () => {
    expect(membersAfter('w4', series)).toEqual([])
    expect(membersAfter('nope', series)).toEqual([])
  })

  it('breaks week ties by module, day, then position in the day', () => {
    const a = pos('a', 2, { moduleOrder: 1, dayOrder: 1 })
    const b = pos('b', 2, { moduleOrder: 1, dayOrder: 2 })
    expect(compareOutlinePosition(a, b)).toBeLessThan(0)
    expect(membersAfter('a', [a, b]).map(m => m.id)).toEqual(['b'])
  })
})

describe('calendar placement', () => {
  // Course starts Wed Jan 7 2026 → week 1 Monday is Jan 5
  it('anchors week 1 to the Monday of the start week', () => {
    expect(weekMonday('2026-01-07', 1)).toBe('2026-01-05')
    expect(weekMonday('2026-01-07', 3)).toBe('2026-01-19')
  })

  it('finds the date of a weekday-named day, and nothing for non-weekday days', () => {
    expect(classDate('2026-01-07', 2, 'Tuesday')).toBe('2026-01-13')
    expect(classDate('2026-01-07', 2, 'Assignments')).toBeNull()
    expect(classDate(null, 2, 'Tuesday')).toBeNull()
    expect(classDate('2026-01-07', null, 'Tuesday')).toBeNull()
  })
})

describe('defaultDueDate', () => {
  it('is the day after', () => {
    expect(defaultDueDate('2026-01-13', []).dueDate).toBe('2026-01-14')
  })

  it('skips the weekend: a Thursday is due Friday, a Friday is due Monday', () => {
    expect(defaultDueDate('2026-01-15', []).dueDate).toBe('2026-01-16')
    expect(defaultDueDate('2026-01-16', []).dueDate).toBe('2026-01-19')
  })

  it('moves past a one-day holiday and says which', () => {
    const mlk = { label: 'MLK Day', start: '2026-01-19', end: null }
    const r = defaultDueDate('2026-01-16', [mlk])
    expect(r.dueDate).toBe('2026-01-20')
    expect(r.skipped).toEqual([mlk])
  })

  it('moves past a whole break week', () => {
    const thanksgiving = { label: 'Thanksgiving Week', start: '2026-11-23', end: '2026-11-27' }
    expect(defaultDueDate('2026-11-20', [thanksgiving]).dueDate).toBe('2026-11-30')
  })

  it('flags when the class day itself is a holiday', () => {
    const labor = { label: 'Labor Day', start: '2026-09-07', end: null }
    const r = defaultDueDate('2026-09-07', [labor])
    expect(r.dueDate).toBe('2026-09-08')
    expect(r.classDayClosure).toEqual(labor)
    expect(r.skipped).toEqual([])
  })

  it('works from week + day name', () => {
    expect(defaultDueDateFor('2026-01-07', 3, 'Friday', [{ label: 'MLK Day', start: '2026-01-26', end: null }])?.dueDate).toBe('2026-01-27')
    expect(defaultDueDateFor('2026-01-07', 3, 'Wiki', [])).toBeNull()
  })
})

describe('placeInWeek', () => {
  // Fall 2026 course starting Mon Sep 7; week 12 Monday = Nov 23 (Thanksgiving Thu Nov 26)
  const start = '2026-09-07'
  const thanksgivingDay = { label: 'Thanksgiving', start: '2026-11-26', end: '2026-11-27' }

  it('keeps the usual day when it is open', () => {
    const p = placeInWeek(start, 11, 'Thursday', [thanksgivingDay])
    expect(p).toMatchObject({ kind: 'placed', dayName: 'Thursday', movedFrom: null })
    expect(p?.kind === 'placed' && p.due.dueDate).toBe('2026-11-20')
  })

  it('moves a holiday Thursday to Wednesday, due the next open day', () => {
    const p = placeInWeek(start, 12, 'Thursday', [thanksgivingDay])
    expect(p).toMatchObject({ kind: 'placed', dayName: 'Wednesday', movedFrom: { dayName: 'Thursday', date: '2026-11-26' } })
    // Wed Nov 25 → Thu/Fri are the holiday, weekend → Mon Nov 30
    expect(p?.kind === 'placed' && p.due.dueDate).toBe('2026-11-30')
  })

  it('moves a holiday Monday to the next open day that week, since nothing earlier is open', () => {
    const labor = { label: 'Labor Day', start: '2026-09-07', end: null }
    const p = placeInWeek(start, 1, 'Monday', [labor])
    expect(p).toMatchObject({ kind: 'placed', dayName: 'Tuesday' })
  })

  it('skips a week that is a break all week', () => {
    const brk = { label: 'Thanksgiving Week', start: '2026-11-23', end: '2026-11-27' }
    expect(placeInWeek(start, 12, 'Thursday', [brk])).toEqual({ kind: 'skipped', closure: brk })
  })

  it('cannot place days without a weekday name or without a calendar', () => {
    expect(placeInWeek(start, 12, 'Assignments', [])).toBeNull()
    expect(placeInWeek(null, 12, 'Thursday', [])).toBeNull()
  })
})

describe('copyDueDate', () => {
  const base = { courseStart: '2026-01-07', closures: [], dayName: 'Tuesday', sourceDueDate: '2026-01-07', fromWeek: 1, toWeek: 4 }

  it('uses the calendar default for the copy\'s own week', () => {
    // week 4 Tuesday = Jan 27 → due Wed Jan 28
    expect(copyDueDate(base)).toBe('2026-01-28')
  })

  it('falls back to moving the source date by the week gap when the calendar can\'t place it', () => {
    expect(copyDueDate({ ...base, courseStart: null })).toBe('2026-01-28')
    expect(shiftDueDateByWeeks('2026-01-07T00:00:00+00:00', 1)).toBe('2026-01-14')
    expect(weeksBetween(1, 4)).toBe(3)
  })

  it('has no due date when neither works', () => {
    expect(copyDueDate({ ...base, courseStart: null, toWeek: null })).toBeNull()
    expect(copyDueDate({ ...base, courseStart: null, sourceDueDate: null })).toBeNull()
  })
})

describe('normalizeGoalLabel', () => {
  it('trims, and treats blank as off', () => {
    expect(normalizeGoalLabel('  I met my typing goal  ')).toBe('I met my typing goal')
    expect(normalizeGoalLabel('   ')).toBeNull()
    expect(normalizeGoalLabel(null)).toBeNull()
  })
})

describe('courseWeeks', () => {
  // Shaped like Intro to Programming (May 2026): stored newest-first, with stray modules
  // that also carry week numbers 1 and 2.
  const mods = [
    { id: 'res', title: 'Course Resources', week_number: null, order: 0 },
    { id: 'extra', title: 'Extra?', week_number: 1, order: 1 },
    { id: 'instr', title: 'Instructor Resources - DO NOT PUBLISH', week_number: 2, order: 2 },
    { id: 'w3', title: 'Week 3: Grid', week_number: 3, order: 3 },
    { id: 'w2', title: 'Week 2: More HTML and CSS', week_number: 2, order: 4 },
    { id: 'w1', title: 'Week 1: HTML review', week_number: 1, order: 5 },
    { id: 'lab', title: 'Lab week', week_number: 4, order: 6 },
  ]

  it('keeps real weeks in week order, preferring the module titled "Week N"', () => {
    expect(courseWeeks(mods).map(m => m.id)).toEqual(['w1', 'w2', 'w3', 'lab'])
  })
})

describe('usualDayName', () => {
  it('is the day most copies sit on, so a holiday move does not change it', () => {
    expect(usualDayName(['Thursday', 'Thursday', 'Wednesday', 'Thursday'])).toBe('Thursday')
    expect(usualDayName([])).toBe('')
  })
})

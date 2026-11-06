import { describe, it, expect } from 'vitest'
import {
  compareOutlinePosition, membersAfter, shiftDueDateByWeeks, copyDueDate, weeksBetween, normalizeGoalLabel,
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

describe('shiftDueDateByWeeks', () => {
  it('keeps no due date as no due date', () => {
    expect(shiftDueDateByWeeks(null, 2)).toBeNull()
  })

  it('moves by whole weeks', () => {
    // Fri Oct 2 2026, 11:59pm PDT
    expect(shiftDueDateByWeeks('2026-10-03T06:59:00.000Z', 1)).toBe('2026-10-10T06:59:00.000Z')
  })

  it('keeps the same Pacific wall time across the fall DST change', () => {
    // Fri Oct 30 2026 11:59pm PDT → Fri Nov 6 2026 11:59pm PST (UTC offset changes by an hour)
    expect(shiftDueDateByWeeks('2026-10-31T06:59:00.000Z', 1)).toBe('2026-11-07T07:59:00.000Z')
  })

  it('can move backwards', () => {
    expect(shiftDueDateByWeeks('2026-10-10T06:59:00.000Z', -1)).toBe('2026-10-03T06:59:00.000Z')
  })
})

describe('copyDueDate', () => {
  it('shifts by the difference in week numbers', () => {
    expect(weeksBetween(1, 4)).toBe(3)
    expect(copyDueDate('2026-10-03T06:59:00.000Z', 1, 3)).toBe('2026-10-17T06:59:00.000Z')
  })

  it('leaves the copy without a due date when either week has no number', () => {
    expect(copyDueDate('2026-10-03T06:59:00.000Z', null, 3)).toBeNull()
    expect(copyDueDate('2026-10-03T06:59:00.000Z', 1, null)).toBeNull()
  })
})

describe('normalizeGoalLabel', () => {
  it('trims, and treats blank as off', () => {
    expect(normalizeGoalLabel('  I met my typing goal  ')).toBe('I met my typing goal')
    expect(normalizeGoalLabel('   ')).toBeNull()
    expect(normalizeGoalLabel(null)).toBeNull()
  })
})

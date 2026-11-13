import { describe, it, expect } from 'vitest'
import {
  buildReadinessBreakdown,
  computeReadinessScore,
  missingToRecoverPoint,
  pickPreviewWeek,
  readinessFactor,
  readinessTips,
  scoredOn,
  summarizeLosses,
  type ReadinessItem,
} from '@/lib/readiness-breakdown'

const item = (n: number): ReadinessItem => ({
  assignmentId: `a${n}`, title: `Assignment ${n}`, courseId: 'c1', priorCourseName: null, dueDate: '2026-10-20', returnedAt: null,
})
const items = (count: number) => Array.from({ length: count }, (_, i) => item(i))

const week = { end: '2026-10-22', returnsEnd: '2026-10-25' } // Thu, Sun
const thursday = '2026-10-22'
const saturday = '2026-10-24'
const nextMonday = '2026-10-26'

describe('computeReadinessScore', () => {
  it('is stepped: only full groups cost a point', () => {
    expect(computeReadinessScore(0, 0, 0)).toBe(5)
    expect(computeReadinessScore(2, 1, 1)).toBe(5)
    expect(computeReadinessScore(3, 2, 2)).toBe(2)
    expect(computeReadinessScore(5, 3, 3)).toBe(2)
  })

  it('never goes below 0', () => {
    expect(computeReadinessScore(30, 10, 16)).toBe(0)
  })
})

describe('readinessFactor / missingToRecoverPoint', () => {
  it('counts how many more until the next point', () => {
    expect(readinessFactor(0, 3)).toEqual({ count: 0, perPoint: 3, pointsLost: 0, untilNextPoint: 3 })
    expect(readinessFactor(4, 3)).toEqual({ count: 4, perPoint: 3, pointsLost: 1, untilNextPoint: 2 })
    expect(readinessFactor(2, 2)).toEqual({ count: 2, perPoint: 2, pointsLost: 1, untilNextPoint: 2 })
  })

  it('says how many missing assignments to turn in for a point back', () => {
    expect(missingToRecoverPoint(readinessFactor(2, 3))).toBeNull()
    expect(missingToRecoverPoint(readinessFactor(3, 3))).toBe(1)
    expect(missingToRecoverPoint(readinessFactor(5, 3))).toBe(3)
    expect(missingToRecoverPoint(readinessFactor(6, 3))).toBe(1)
  })
})

describe('buildReadinessBreakdown', () => {
  it('matches computeReadinessScore and keeps the items', () => {
    const b = buildReadinessBreakdown({ blocksMissed: 3, blocksTotal: 8, missing: items(4), returns: items(2) })
    expect(b.score).toBe(computeReadinessScore(4, 2, 3))
    expect(b.score).toBe(2)
    expect(b.zone).toBe('yellow')
    expect(b.attendance).toMatchObject({ count: 3, blocksTotal: 8, pointsLost: 1 })
    expect(b.missing.items).toHaveLength(4)
    expect(b.needsRevision.pointsLost).toBe(1)
  })
})

describe('summarizeLosses', () => {
  it('lists only what cost points, and nothing when no points are lost', () => {
    expect(summarizeLosses(buildReadinessBreakdown({ blocksMissed: 1, blocksTotal: 8, missing: items(2), returns: items(1) })))
      .toBeNull()
    expect(summarizeLosses(buildReadinessBreakdown({ blocksMissed: 2, blocksTotal: 8, missing: items(6), returns: [] })))
      .toBe('−1 attendance, −2 missing work')
  })
})

describe('readinessTips', () => {
  it('warns about the next point only once something has happened', () => {
    const clean = buildReadinessBreakdown({ blocksMissed: 0, blocksTotal: 4, missing: [], returns: [] })
    expect(readinessTips(clean, week, '2026-10-20')).toEqual({ attendance: null, missing: [], needsRevision: null })

    const close = buildReadinessBreakdown({ blocksMissed: 1, blocksTotal: 4, missing: items(2), returns: items(1) })
    expect(readinessTips(close, week, '2026-10-20')).toEqual({
      attendance: '1 more missed block this week would cost a point.',
      missing: ['1 more assignment going missing would cost a point.'],
      needsRevision: '1 more return for revision by Sunday would cost a point.',
    })
  })

  it('offers a point back for turning in missing work', () => {
    const b = buildReadinessBreakdown({ blocksMissed: 0, blocksTotal: 4, missing: items(4), returns: [] })
    expect(readinessTips(b, week, thursday).missing).toEqual([
      'Turning in 2 missing assignments would win back a point.',
      '2 more assignments going missing would cost another point.',
    ])
  })

  it('stops attendance warnings after Thursday and return warnings after Sunday', () => {
    const b = buildReadinessBreakdown({ blocksMissed: 1, blocksTotal: 8, missing: [], returns: items(1) })
    expect(readinessTips(b, week, thursday).attendance).not.toBeNull()
    expect(readinessTips(b, week, saturday).attendance).toBeNull()
    expect(readinessTips(b, week, saturday).needsRevision).not.toBeNull()
    expect(readinessTips(b, week, nextMonday).needsRevision).toBeNull()
  })

  it('notes when no attendance has been recorded', () => {
    const b = buildReadinessBreakdown({ blocksMissed: 0, blocksTotal: 0, missing: [], returns: [] })
    expect(readinessTips(b, week, '2026-10-19').attendance).toBe('No attendance recorded yet this week.')
    expect(readinessTips(b, week, saturday).attendance).toBe('No attendance recorded for this week.')
  })

  it('gives no next-point warnings at a score of 0', () => {
    const b = buildReadinessBreakdown({ blocksMissed: 8, blocksTotal: 8, missing: items(7), returns: items(3) })
    expect(b.score).toBe(0)
    const tips = readinessTips(b, week, '2026-10-20')
    expect(tips.attendance).toBeNull()
    expect(tips.needsRevision).toBeNull()
    expect(tips.missing).toEqual(['Turning in 2 missing assignments would win back a point.'])
  })
})

describe('pickPreviewWeek / scoredOn', () => {
  const ranges = { thisWeek: { start: '2026-10-26', end: '2026-10-29' }, lastWeek: { start: '2026-10-19', end: '2026-10-22' } }

  it('previews this week, except on a Monday before last week is scored', () => {
    expect(pickPreviewWeek(ranges, '2026-10-27', false)).toBe(ranges.thisWeek)
    expect(pickPreviewWeek(ranges, '2026-10-26', true)).toBe(ranges.thisWeek)
    expect(pickPreviewWeek(ranges, '2026-10-26', false)).toBe(ranges.lastWeek)
  })

  it('finalizes on the following Monday', () => {
    expect(scoredOn('2026-10-19')).toBe('2026-10-26')
    expect(scoredOn('2026-10-26')).toBe('2026-11-02') // across a month + DST change
  })
})

import { describe, it, expect } from 'vitest'
import { computeClassAverages, isTesterEmail, normalizeEmail, type WeekStats } from '@/lib/readiness-summary'

describe('normalizeEmail / isTesterEmail', () => {
  const staff = new Set(['rai@anniecannons.com', 'catiehart@mac.com'])

  it('drops +tags and lowercases', () => {
    expect(normalizeEmail(' Rai+1@AnnieCannons.com ')).toBe('rai@anniecannons.com')
  })

  it('flags +tag and exact staff emails as testers', () => {
    expect(isTesterEmail('rai+2@anniecannons.com', staff)).toBe(true)
    expect(isTesterEmail('catiehart@mac.com', staff)).toBe(true)
  })

  it('does not flag real students or missing emails', () => {
    expect(isTesterEmail('student@gmail.com', staff)).toBe(false)
    expect(isTesterEmail('rain@anniecannons.com', staff)).toBe(false)
    expect(isTesterEmail(null, staff)).toBe(false)
  })
})

describe('computeClassAverages', () => {
  const week = (over: Partial<WeekStats>): WeekStats => ({
    score: 5, zone: 'green', missing: 0, needsRevision: 0, blocksMissed: 0, blocksTotal: 16, ...over,
  })

  it('averages score, missing and needs revision and counts zones', () => {
    const avg = computeClassAverages([
      week({ score: 5, missing: 1, needsRevision: 1 }),
      week({ score: 3, zone: 'yellow', missing: 1, needsRevision: 5 }),
    ])
    expect(avg.studentCount).toBe(2)
    expect(avg.score).toBe(4)
    expect(avg.missing).toBe(1)
    expect(avg.needsRevision).toBe(3)
    expect(avg.zoneCounts).toEqual({ red: 0, yellow: 1, green: 1 })
  })

  it('leaves students without Airtable attendance out of the blocks-missed average', () => {
    const avg = computeClassAverages([
      week({ blocksMissed: 2, blocksTotal: 16 }),
      week({ blocksMissed: 0, blocksTotal: 0 }),
    ])
    expect(avg.blocksMissed).toBe(2)
    expect(avg.blocksTotal).toBe(16)
  })

  it('returns nulls for an empty week', () => {
    const avg = computeClassAverages([])
    expect(avg.score).toBeNull()
    expect(avg.blocksMissed).toBeNull()
  })
})

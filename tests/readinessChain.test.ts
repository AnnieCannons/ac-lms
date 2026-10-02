import { describe, it, expect } from 'vitest'
import { findPredecessorCourse, type ChainCourse } from '@/lib/readiness-chain'
import { courseRanDuringWeek } from '@/lib/weekly-report'

const course = (id: string, name: string, start_date: string, extra: Partial<ChainCourse> = {}): ChainCourse => ({
  id, name, start_date, is_template: false, airtable_course_name: null, ...extra,
})

const tcfSept = course('tcf-sept', 'Tech Career Foundations (Sept 2026)', '2026-09-08', { airtable_course_name: 'Sept 2026 - TCF/ITP' })
const itpSept = course('itp-sept', 'Intro to Programming (Sept 2026)', '2026-10-05', { airtable_course_name: 'Sept 2026 - TCF/ITP' })
const tcfMay = course('tcf-may', 'The Coding Foundation (May 2026)', '2026-05-04')
const itpMay = course('itp-may', 'ITP (May 2026)', '2026-06-01')
const backendSept = course('be-sept', 'Advanced Backend (Sept 2026)', '2026-09-08')
const all = [tcfSept, itpSept, tcfMay, itpMay, backendSept]

describe('findPredecessorCourse', () => {
  it('links an ITP course to its same-term TCF course', () => {
    expect(findPredecessorCourse(itpSept, all)?.id).toBe('tcf-sept')
    expect(findPredecessorCourse(itpMay, all)?.id).toBe('tcf-may')
  })

  it('gives TCF itself no predecessor', () => {
    expect(findPredecessorCourse(tcfSept, all)).toBeNull()
  })

  it('never chains across terms or tracks', () => {
    expect(findPredecessorCourse(backendSept, all)).toBeNull()
    const itpJan = course('itp-jan', 'Intro to Programming (Jan 2027)', '2027-02-01')
    expect(findPredecessorCourse(itpJan, [...all, itpJan])).toBeNull()
  })

  it('still finds an archived TCF but ignores templates', () => {
    const template = course('tpl', 'Tech Career Foundations (Sept 2026)', '2026-09-01', { is_template: true })
    expect(findPredecessorCourse(itpSept, [template, itpSept])).toBeNull()
  })
})

describe('courseRanDuringWeek', () => {
  const tcfFinalWeek = { start: '2026-09-28', end: '2026-10-01' }
  const itpFirstWeek = { start: '2026-10-05', end: '2026-10-08' }

  it('scores TCF for its final week even though it ended before Monday', () => {
    expect(courseRanDuringWeek('2026-09-08', '2026-10-03', tcfFinalWeek)).toBe(true)
  })

  it('does not score TCF after its final week', () => {
    expect(courseRanDuringWeek('2026-09-08', '2026-10-03', itpFirstWeek)).toBe(false)
  })

  it('does not score ITP for the week before it starts', () => {
    expect(courseRanDuringWeek('2026-10-05', '2026-12-18', tcfFinalWeek)).toBe(false)
    expect(courseRanDuringWeek('2026-10-05', '2026-12-18', itpFirstWeek)).toBe(true)
  })

  it('falls back to 105 days when there is no end date', () => {
    expect(courseRanDuringWeek('2026-09-08', null, { start: '2026-12-21', end: '2026-12-24' })).toBe(true)
    expect(courseRanDuringWeek('2026-09-08', null, { start: '2026-12-28', end: '2026-12-31' })).toBe(false)
  })
})

describe('sundayAfter', () => {
  it('extends the scoring week through Sunday for counting returns', async () => {
    const { sundayAfter } = await import('@/lib/readiness')
    expect(sundayAfter('2026-09-28')).toBe('2026-10-04')
    expect(sundayAfter('2026-10-26')).toBe('2026-11-01') // across a month + DST change
  })
})

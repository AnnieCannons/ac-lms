import { describe, it, expect } from 'vitest'
import { weekFromTitle, titleWeekMismatch } from '@/lib/module-week'

describe('weekFromTitle', () => {
  it('reads the leading "Week N"', () => {
    expect(weekFromTitle('Week 5: APIs')).toBe(5)
    expect(weekFromTitle('  week 12 - Forms')).toBe(12)
  })

  it('returns null when the title has no leading week', () => {
    expect(weekFromTitle('Frontend Mentor projects')).toBeNull()
    expect(weekFromTitle('Review for Week 5')).toBeNull()
    expect(weekFromTitle(null)).toBeNull()
  })
})

describe('titleWeekMismatch', () => {
  it('flags a module whose saved week disagrees with its title', () => {
    expect(titleWeekMismatch('Week 4: More Loops + Functions + Scope', 5)).toBe(4)
  })

  it('does not flag a matching module', () => {
    expect(titleWeekMismatch('Week 5: APIs', 5)).toBeNull()
  })

  it('does not flag a module that is off the calendar (null week)', () => {
    expect(titleWeekMismatch('Week 4: Career Week (none in Fall 2026)', null)).toBeNull()
  })

  it('does not flag a module without a week in its title', () => {
    expect(titleWeekMismatch('Frontend Mentor projects', 5)).toBeNull()
  })
})

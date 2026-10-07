import { describe, it, expect } from 'vitest'
import { maxExtensionDate, isWithinExtensionLimit } from '@/lib/extension-limits'

const now = new Date('2026-10-07T12:00:00Z')

describe('maxExtensionDate', () => {
  it('is 7 days past an upcoming due date', () => {
    expect(maxExtensionDate('2026-10-09T03:59:00Z', now).toISOString()).toBe('2026-10-16T03:59:00.000Z')
  })

  it('is 7 days from now when the assignment is already overdue', () => {
    expect(maxExtensionDate('2026-09-01T03:59:00Z', now).toISOString()).toBe('2026-10-14T12:00:00.000Z')
  })

  it('is 7 days from now when there is no due date', () => {
    expect(maxExtensionDate(null, now).toISOString()).toBe('2026-10-14T12:00:00.000Z')
  })
})

describe('isWithinExtensionLimit', () => {
  const due = '2026-10-09T03:59:00Z' // Thu Oct 8, 11:59pm ET

  it('allows 11:59pm ET on the 7th day', () => {
    expect(isWithinExtensionLimit('2026-10-16T03:59:00Z', due, now)).toBe(true)
  })

  it('rejects a request a month out', () => {
    expect(isWithinExtensionLimit('2026-11-08T04:59:00Z', due, now)).toBe(false)
  })

  it('rejects the day after the 7-day window', () => {
    expect(isWithinExtensionLimit('2026-10-17T03:59:00Z', due, now)).toBe(false)
  })

  it('rejects garbage dates', () => {
    expect(isWithinExtensionLimit('not a date', due, now)).toBe(false)
  })
})

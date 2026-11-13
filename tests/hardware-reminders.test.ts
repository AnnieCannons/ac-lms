import { describe, it, expect } from 'vitest'
import {
  addDays,
  breakPeriods,
  currentSubscription,
  daysBetween,
  graduateReviewDue,
  nextReturnReminderAt,
  renewalState,
  returnReminderText,
} from '@/lib/hardware-reminders'

describe('dates', () => {
  it('counts whole days between dates', () => {
    expect(daysBetween('2026-10-16', '2026-11-30')).toBe(45)
    expect(daysBetween('2026-10-16', '2026-10-15')).toBe(-1)
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('renewalState', () => {
  it('is due within 45 days, expired after the end date', () => {
    expect(renewalState('2026-11-30', '2026-10-16')).toBe('due')
    expect(renewalState('2026-12-01', '2026-10-16')).toBe('ok')
    expect(renewalState('2026-10-15', '2026-10-16')).toBe('expired')
    expect(renewalState('2026-10-16', '2026-10-16')).toBe('due')
  })
})

describe('currentSubscription', () => {
  it('picks the plan ending last', () => {
    const a = { id: 'a', ends_on: '2026-01-01' }
    const b = { id: 'b', ends_on: '2027-01-01' }
    expect(currentSubscription([a, b])).toBe(b)
    expect(currentSubscription([])).toBeNull()
  })
})

describe('nextReturnReminderAt', () => {
  const at = new Date('2026-10-16T15:30:00Z')
  it('waits 5 days after the first reminder, then 7', () => {
    expect(nextReturnReminderAt(1, at).toISOString()).toBe('2026-10-21T15:30:00.000Z')
    expect(nextReturnReminderAt(2, at).toISOString()).toBe('2026-10-23T15:30:00.000Z')
    expect(nextReturnReminderAt(5, at).toISOString()).toBe('2026-10-23T15:30:00.000Z')
  })
})

describe('returnReminderText', () => {
  it('names the items and includes the return steps and link', () => {
    const t = returnReminderText('Tamela Jones', [{ asset_tag: 'LAP-014', kind: 'laptop' }], 'https://x/eq')
    expect(t.subject).toBe('Please send back your AnnieCannons laptop')
    expect(t.text).toMatch(/^Hi Tamela, this is a reminder to send back your AnnieCannons laptop \(LAP-014\)\./)
    expect(t.text).toMatch(/1\. Use the box it came in/)
    expect(t.text).toMatch(/Details: https:\/\/x\/eq$/)
    expect(t.bell).toBe('Please send back your laptop (LAP-014). See how on My Equipment.')
  })
})

describe('break periods and the graduate review', () => {
  const rows = [
    { label: 'Fall Break', start_date: '2026-08-24' },
    { label: 'Holiday Break Week 1', start_date: '2026-12-21' },
    { label: 'Winter Break', start_date: '2026-12-21' },
    { label: 'Holiday Break Week 2', start_date: '2027-01-04' },
    { label: 'Spring Break', start_date: '2027-04-26' },
  ]
  it('folds overlapping winter rows into one break', () => {
    expect(breakPeriods(rows)).toEqual([
      { start: '2026-08-24', labels: ['Fall Break'] },
      { start: '2026-12-21', labels: ['Holiday Break Week 1', 'Winter Break', 'Holiday Break Week 2'] },
      { start: '2027-04-26', labels: ['Spring Break'] },
    ])
  })
  it('is due on the first day of a break, or a few days late, but not mid-break', () => {
    const periods = breakPeriods(rows)
    expect(graduateReviewDue(periods, '2026-12-21')?.start).toBe('2026-12-21')
    expect(graduateReviewDue(periods, '2026-12-24')?.start).toBe('2026-12-21')
    expect(graduateReviewDue(periods, '2027-01-04')).toBeNull()
    expect(graduateReviewDue(periods, '2026-12-20')).toBeNull()
  })
})

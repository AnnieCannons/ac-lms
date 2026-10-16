import { describe, it, expect } from 'vitest'
import {
  audienceCourseIds,
  buildReportRows,
  canChangeRsvp,
  defaultDueDates,
  followUpStatus,
  isQuestionRequired,
  isThanksRequired,
  needsReminder,
  openTaskCount,
  openReminderKinds,
  pacificDate,
  pacificTime,
  pacificToUtcIso,
  primaryCourseFor,
  summarize,
  validateEventInput,
  type CuttingEdgeRsvp,
  type EventInput,
} from '@/lib/cutting-edge'

// Oct 23 2026, 12:00pm Pacific (PDT, UTC-7)
const event = { starts_at: '2026-10-23T19:00:00.000Z', audience_all: true, question_due_date: '2026-10-16', thanks_due_date: '2026-10-30' }
const before = new Date('2026-10-20T17:00:00Z')
const after = new Date('2026-10-24T17:00:00Z')

const rsvp = (over: Partial<CuttingEdgeRsvp> = {}): CuttingEdgeRsvp => ({
  event_id: 'e1', user_id: 'u1', response: 'yes', question_done_at: null, thanks_done_at: null, missed_at: null, ...over,
})

describe('Pacific time', () => {
  it('converts a Pacific wall time to UTC across daylight saving', () => {
    expect(pacificToUtcIso('2026-10-23', '12:00')).toBe('2026-10-23T19:00:00.000Z') // PDT
    expect(pacificToUtcIso('2026-11-06', '12:00')).toBe('2026-11-06T20:00:00.000Z') // PST
  })

  it('round-trips date and time', () => {
    const iso = pacificToUtcIso('2026-11-06', '09:30')
    expect(pacificDate(iso)).toBe('2026-11-06')
    expect(pacificTime(iso)).toBe('09:30')
  })

  it('uses the Pacific date, not the UTC date, late in the evening', () => {
    expect(pacificDate('2026-10-24T05:00:00Z')).toBe('2026-10-23')
  })

  it('defaults due dates to 7 days before and after, across month and DST boundaries', () => {
    expect(defaultDueDates('2026-11-06')).toEqual({ questionDueDate: '2026-10-30', thanksDueDate: '2026-11-13' })
    expect(defaultDueDates('2026-03-03')).toEqual({ questionDueDate: '2026-02-24', thanksDueDate: '2026-03-10' })
  })
})

describe('audience', () => {
  const courses = [
    { id: 'current', start_date: '2026-09-08', end_date: null },
    { id: 'ended', start_date: '2026-01-05', end_date: null },
    { id: 'future', start_date: '2026-10-20', end_date: null },
    { id: 'explicit-end', start_date: '2026-06-01', end_date: '2026-10-01' },
  ]

  it('defaults to courses active at the event (and now, while upcoming)', () => {
    const ids = audienceCourseIds(event, [], courses, before)
    expect([...ids].sort()).toEqual(['current', 'future'])
  })

  it('freezes a past event to courses active on the event date', () => {
    const later = new Date('2027-06-01T00:00:00Z')
    expect([...audienceCourseIds(event, [], courses, later)].sort()).toEqual(['current', 'future'])
  })

  it('uses only the chosen courses when limited', () => {
    expect([...audienceCourseIds({ ...event, audience_all: false }, ['ended'], courses, before)]).toEqual(['ended'])
  })

  it('groups a student under their most recently started audience course', () => {
    const map = new Map(courses.map(c => [c.id, c]))
    expect(primaryCourseFor(['current', 'future'], new Set(['current', 'future']), map)).toBe('future')
    expect(primaryCourseFor(['ended'], new Set(['current']), map)).toBeNull()
  })
})

describe('RSVP and assignment rules', () => {
  it('lets RSVPs change until the event starts', () => {
    expect(canChangeRsvp(event, before)).toBe(true)
    expect(canChangeRsvp(event, new Date('2026-10-23T19:00:00Z'))).toBe(false)
  })

  it('requires the question only for yes RSVPs', () => {
    expect(isQuestionRequired(rsvp())).toBe(true)
    expect(isQuestionRequired(rsvp({ response: 'no' }))).toBe(false)
    expect(isQuestionRequired(null)).toBe(false)
  })

  it('requires the thank-you only for yes RSVPs, after the event', () => {
    expect(isThanksRequired(event, rsvp(), before)).toBe(false)
    expect(isThanksRequired(event, rsvp(), after)).toBe(true)
    expect(isThanksRequired(event, rsvp({ response: 'no' }), after)).toBe(false)
  })

  it('treats "did not make it" as excused, never as no follow-up', () => {
    const wayLater = new Date('2026-12-01T17:00:00Z')
    expect(followUpStatus(event, rsvp({ missed_at: 'x' }), wayLater)).toBe('missed')
    expect(followUpStatus(event, rsvp({ thanks_done_at: 'x' }), wayLater)).toBe('thanked')
    expect(followUpStatus(event, rsvp(), after)).toBe('pending')
    expect(followUpStatus(event, rsvp(), wayLater)).toBe('no_follow_up')
    expect(followUpStatus(event, rsvp({ response: 'no' }), wayLater)).toBe('not_required')
  })
})

describe('openTaskCount (nav "Tasks due" badge)', () => {
  it('counts an owed question before the talk and an owed thank-you after it', () => {
    const items = [
      { event, rsvp: rsvp() },                                 // question owed
      { event, rsvp: rsvp({ question_done_at: 'x' }) },        // done
      { event, rsvp: rsvp({ response: 'no' }) },               // not going
      { event, rsvp: null },                                   // no RSVP isn't a task
    ]
    expect(openTaskCount(items, before)).toBe(1)
    expect(openTaskCount([
      { event, rsvp: rsvp() },                                 // thank-you owed
      { event, rsvp: rsvp({ missed_at: 'x' }) },               // excused
      { event, rsvp: rsvp({ thanks_done_at: 'x' }) },          // done
    ], after)).toBe(1)
  })
})

describe('reminders', () => {
  it('opens the question window 2 days before its due date, until the due date', () => {
    expect(openReminderKinds(event, new Date('2026-10-13T15:30:00Z'))).toEqual([])
    expect(openReminderKinds(event, new Date('2026-10-14T15:30:00Z'))).toEqual(['question_reminder'])
    expect(openReminderKinds(event, new Date('2026-10-16T15:30:00Z'))).toEqual(['question_reminder'])
    expect(openReminderKinds(event, new Date('2026-10-17T15:30:00Z'))).toEqual([])
  })

  it('opens the thank-you window the morning after the event', () => {
    expect(openReminderKinds(event, new Date('2026-10-23T22:00:00Z'))).toEqual([])
    expect(openReminderKinds(event, new Date('2026-10-24T15:30:00Z'))).toEqual(['thanks_reminder'])
    expect(openReminderKinds(event, new Date('2026-10-31T15:30:00Z'))).toEqual([])
  })

  it('reminds only yes RSVPs who have not done or been excused from the item', () => {
    expect(needsReminder('question_reminder', rsvp())).toBe(true)
    expect(needsReminder('question_reminder', rsvp({ question_done_at: 'x' }))).toBe(false)
    expect(needsReminder('question_reminder', rsvp({ response: 'no' }))).toBe(false)
    expect(needsReminder('question_reminder', null)).toBe(false)
    expect(needsReminder('thanks_reminder', rsvp())).toBe(true)
    expect(needsReminder('thanks_reminder', rsvp({ thanks_done_at: 'x' }))).toBe(false)
    expect(needsReminder('thanks_reminder', rsvp({ missed_at: 'x' }))).toBe(false)
  })
})

describe('report', () => {
  it('counts RSVPs, completions and no-shows, including students outside the audience', () => {
    const wayLater = new Date('2026-12-01T17:00:00Z')
    const rows = buildReportRows(
      event,
      [
        { id: 'a', name: 'Ada', courseId: 'c1' },
        { id: 'b', name: 'Bo', courseId: 'c1' },
        { id: 'c', name: 'Cy', courseId: 'c2' },
        { id: 'd', name: 'Di', courseId: 'c2' },
      ],
      [
        rsvp({ user_id: 'a', question_done_at: 'x', thanks_done_at: 'x' }),
        rsvp({ user_id: 'b', missed_at: 'x' }),
        rsvp({ user_id: 'c' }),
        rsvp({ user_id: 'x', response: 'no' }),
      ],
      [{ id: 'x', name: 'Xi', courseId: null }],
      wayLater,
    )
    expect(summarize(rows)).toEqual({ yes: 3, no: 0, noResponse: 1, questionDone: 1, thanked: 1, missed: 1, noFollowUp: 1 })
    expect(rows.find(r => r.id === 'x')?.inAudience).toBe(false)
    expect(summarize(rows.filter(r => r.courseId === 'c2'))).toMatchObject({ yes: 1, noResponse: 1, noFollowUp: 1 })
  })
})

describe('validateEventInput', () => {
  const valid: EventInput = {
    title: 'Talk', speaker: 'Shawna Faulkner', date: '2026-10-23', time: '12:00', startsAt: '2026-10-23T19:00:00.000Z', block: '',
    locationText: 'Focus Friday Zoom', locationUrl: '',
    aboutHtml: '', audienceAll: true, courseIds: [], questionDueDate: '2026-10-16', questionHtml: '', questionPadletUrl: '',
    thanksDueDate: '2026-10-30', thanksHtml: '', thanksPadletUrl: '',
  }

  it('accepts an event with no Padlet links yet', () => {
    expect(validateEventInput(valid)).toBeNull()
  })

  it('requires speaker and where, and only allows blocks A–D', () => {
    expect(validateEventInput({ ...valid, speaker: ' ' })).toMatch(/Speaker/)
    expect(validateEventInput({ ...valid, locationText: '' })).toMatch(/Where/)
    expect(validateEventInput({ ...valid, startsAt: '' })).toMatch(/date and time/)
    expect(validateEventInput({ ...valid, block: 'B' })).toBeNull()
    expect(validateEventInput({ ...valid, block: 'E' as never })).toMatch(/Block/)
  })

  it('rejects a limited audience with no classes, bad links, and a thank-you due before the event', () => {
    expect(validateEventInput({ ...valid, audienceAll: false })).toMatch(/class/)
    expect(validateEventInput({ ...valid, questionPadletUrl: 'javascript:alert(1)' })).toMatch(/Padlet/)
    expect(validateEventInput({ ...valid, thanksDueDate: '2026-10-20' })).toMatch(/before the event/)
  })
})

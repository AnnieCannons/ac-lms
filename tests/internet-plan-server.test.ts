import { describe, it, expect, vi, beforeEach } from 'vitest'

const slackIds: Record<string, string> = {}
const posts: [string, string][] = []
const dms: [string, string][] = []
vi.mock('@/lib/slack', () => ({
  slackLookupByEmail: vi.fn(async (email: string) => slackIds[email] ?? null),
  openGroupDM: vi.fn(async (ids: string[]) => `G-${ids.join('-')}`),
  slackPostMessage: vi.fn(async (channel: string, text: string) => { posts.push([channel, text]); return true }),
  notifyByEmail: vi.fn(async (email: string, text: string) => { dms.push([email, text]); return true }),
}))

import { notifyPlanCancelOnObserver, sendReceiptReminder } from '@/lib/internet-plan-server'

/** Fake service client: each table resolves to the given result. */
function db(results: Record<string, unknown>) {
  const chain = (result: unknown): unknown => new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return () => chain(result)
    },
  })
  return { from: (table: string) => chain(results[table] ?? { data: null }) } as never
}

const plan = { id: 'p1', student_id: 'st', starts_on: '2026-11-25', ends_on: null, created_by: 'catie' }

beforeEach(() => {
  posts.length = 0
  dms.length = 0
  for (const k of Object.keys(slackIds)) delete slackIds[k]
  delete process.env.COMCAST_NOW_CONTACT_EMAIL
})

describe('sendReceiptReminder', () => {
  it('asks for the receipt in a group message with whoever recorded the plan and the student', async () => {
    Object.assign(slackIds, { 'catie@example.org': 'UCATIE', 'jordan@example.com': 'UJORDAN' })
    const admin = db({ users: { data: { name: 'Jordan Rivera', email: 'jordan@example.com' } } })
    // users is read for both the student and the contact; the contact's email comes from the same fake row,
    // so pin the contact with the setting instead
    process.env.COMCAST_NOW_CONTACT_EMAIL = 'catie@example.org'
    expect(await sendReceiptReminder(admin, plan)).toBe(true)
    expect(posts).toEqual([['G-UCATIE-UJORDAN', expect.stringContaining("Hi Jordan! Your Comcast NOW internet renewed today. Please send this month's receipt here")]])
  })

  it('DMs the contact instead when the student isn’t on Slack', async () => {
    Object.assign(slackIds, { 'catie@example.org': 'UCATIE' })
    process.env.COMCAST_NOW_CONTACT_EMAIL = 'catie@example.org'
    const admin = db({ users: { data: { name: 'Jordan Rivera', email: 'jordan@example.com' } } })
    expect(await sendReceiptReminder(admin, plan)).toBe(true)
    expect(posts).toEqual([])
    expect(dms[0][0]).toBe('catie@example.org')
    expect(dms[0][1]).toContain('ask them for this month')
  })
})

describe('notifyPlanCancelOnObserver', () => {
  it('DMs the contact to cancel the card when the plan is still running', async () => {
    process.env.COMCAST_NOW_CONTACT_EMAIL = 'catie@example.org'
    const admin = db({
      hardware_internet_plans: { data: [plan] },
      users: { data: { name: 'Jordan Rivera', email: 'jordan@example.com' } },
      courses: { data: { name: 'Tech Career Foundations (Jan 2027)' } },
    })
    await notifyPlanCancelOnObserver(admin, 'st', 'c1')
    expect(dms).toHaveLength(1)
    expect(dms[0][1]).toContain('Jordan Rivera was changed to observer in Tech Career Foundations (Jan 2027)')
    expect(dms[0][1]).toContain('cancel the credit card')
  })

  it('stays quiet when there’s no current plan', async () => {
    process.env.COMCAST_NOW_CONTACT_EMAIL = 'catie@example.org'
    await notifyPlanCancelOnObserver(db({ hardware_internet_plans: { data: [{ ...plan, starts_on: '2026-09-01', ends_on: '2026-11-01' }] } }), 'st', 'c1')
    await notifyPlanCancelOnObserver(db({ hardware_internet_plans: { data: [] } }), 'st', 'c1')
    expect(dms).toEqual([])
  })
})

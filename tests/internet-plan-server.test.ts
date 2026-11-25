import { describe, it, expect, vi, beforeEach } from 'vitest'

const slackIds: Record<string, string> = {}
const posts: [string, string][] = []
vi.mock('@/lib/slack', () => ({
  slackLookupByEmail: vi.fn(async (email: string) => slackIds[email] ?? null),
  openGroupDM: vi.fn(async (ids: string[]) => `G-${ids.join('-')}`),
  slackPostMessage: vi.fn(async (channel: string, text: string) => { posts.push([channel, text]); return true }),
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
const CHANNEL = 'C0ABALJLBFU'

beforeEach(() => {
  posts.length = 0
  for (const k of Object.keys(slackIds)) delete slackIds[k]
  process.env.COMCAST_NOW_CONTACT_EMAIL = 'catie@example.org'
  delete process.env.SLACK_HARDWARE_CHANNEL
})

describe('sendReceiptReminder', () => {
  const student = { users: { data: { name: 'Jordan Rivera', email: 'jordan@example.com' } } }

  it('asks for the receipt in a group message with Catie and the student', async () => {
    Object.assign(slackIds, { 'catie@example.org': 'UCATIE', 'jordan@example.com': 'UJORDAN' })
    expect(await sendReceiptReminder(db(student), plan)).toBe(true)
    expect(posts).toEqual([['G-UCATIE-UJORDAN', expect.stringContaining("Hi Jordan! Your Comcast NOW internet renewed today. Please send this month's receipt here")]])
  })

  it('falls back to #student-hardware, tagging Catie, when the student isn’t on Slack', async () => {
    slackIds['catie@example.org'] = 'UCATIE'
    await sendReceiptReminder(db(student), plan)
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe(CHANNEL)
    expect(posts[0][1]).toMatch(/^<@UCATIE> 💳 Comcast NOW renewed today for <.*\|Jordan Rivera>, but I couldn't message them on Slack/)
  })
})

describe('notifyPlanCancelOnObserver', () => {
  it('asks Catie in #student-hardware to cancel the card when the plan is still running', async () => {
    slackIds['catie@example.org'] = 'UCATIE'
    await notifyPlanCancelOnObserver(db({
      hardware_internet_plans: { data: [plan] },
      users: { data: { name: 'Jordan Rivera', email: 'jordan@example.com' } },
      courses: { data: { name: 'Tech Career Foundations (Jan 2027)' } },
    }), 'st', 'c1')
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe(CHANNEL)
    expect(posts[0][1]).toContain('<@UCATIE> 💳 Jordan Rivera was changed to observer in Tech Career Foundations (Jan 2027)')
    expect(posts[0][1]).toContain('cancel the credit card')
  })

  it('stays quiet when there’s no current plan', async () => {
    await notifyPlanCancelOnObserver(db({ hardware_internet_plans: { data: [{ ...plan, starts_on: '2026-09-01', ends_on: '2026-11-01' }] } }), 'st', 'c1')
    await notifyPlanCancelOnObserver(db({ hardware_internet_plans: { data: [] } }), 'st', 'c1')
    expect(posts).toEqual([])
  })
})

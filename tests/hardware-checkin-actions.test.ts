import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/slack', () => ({ notifyByEmail: vi.fn() }))

import {
  addHardwareCheckinRecipients,
  approveHardwareCheckinResponse,
  createHardwareCheckin,
  dismissHardwareCheckinResponse,
  nudgeHardwareCheckin,
  setHardwareCheckinClosed,
  submitMyHardwareCheckin,
} from '@/lib/hardware-checkin-actions'
import { emptyCheckinInput } from '@/lib/hardware-checkin'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

// Thenable chain: every method returns the chain; awaiting it resolves to `result`.
function chain(result: unknown, log?: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log?.push([String(prop), args]); return c }
    },
  })
  return c as never
}

function signedInAs(role: string, id = 'me') {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id } } }) },
    from: () => chain({ data: { role } }),
  } as never)
}

/** Service client whose `from(table)` resolves to the result given for that table. */
function serviceWith(results: Record<string, unknown>) {
  const log: [string, unknown[]][] = []
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => { log.push(['from', [table]]); return chain(results[table] ?? { data: null, error: null }, log) },
  } as never)
  return log
}

const choices = { laptop: true, hotspot: true, booster: true, replacements: true, laptopOwned: false }

beforeEach(() => vi.clearAllMocks())

describe('staff-only check-in actions', () => {
  it.each(['student', 'ta'])('rejects a %s', async role => {
    signedInAs(role)
    expect(await createHardwareCheckin({ title: 'x', courseIds: ['c1'], personIds: [] })).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await addHardwareCheckinRecipients('s', [], ['u'])).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await nudgeHardwareCheckin('s')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await setHardwareCheckinClosed('s', true)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await approveHardwareCheckinResponse('r', choices)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await dismissHardwareCheckinResponse('r', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('needs at least one course or person', async () => {
    signedInAs('staff')
    expect(await createHardwareCheckin({ title: 'Fall', courseIds: [], personIds: [] })).toEqual({ ok: false, error: 'Choose at least one course or person.' })
  })

  it('will not approve a response twice', async () => {
    signedInAs('admin')
    serviceWith({ hardware_survey_responses: { data: { id: 'r', user_id: 's1', review_status: 'approved' }, error: null } })
    expect(await approveHardwareCheckinResponse('r', choices)).toEqual({ ok: false, error: 'This response was already reviewed.' })
  })
})

describe('submitMyHardwareCheckin', () => {
  it("refuses a student who wasn't sent the check-in", async () => {
    signedInAs('student', 's1')
    serviceWith({ hardware_survey_recipients: { data: null, error: null }, hardware_surveys: { data: { closed_at: null }, error: null } })
    expect(await submitMyHardwareCheckin('sv', emptyCheckinInput())).toEqual({ ok: false, error: "This check-in isn't for you." })
  })

  it('refuses once the answers were reviewed', async () => {
    signedInAs('student', 's1')
    const log = serviceWith({
      hardware_survey_recipients: { data: { user_id: 's1' }, error: null },
      hardware_surveys: { data: { closed_at: null }, error: null },
      hardware_survey_responses: { data: { review_status: 'approved' }, error: null },
    })
    expect(await submitMyHardwareCheckin('sv', emptyCheckinInput())).toMatchObject({ ok: false, error: expect.stringMatching(/already recorded/) })
    expect(log.some(([m]) => m === 'upsert')).toBe(false)
  })

  it('saves only under the signed-in student, whatever is passed in', async () => {
    signedInAs('student', 's1')
    const log = serviceWith({
      hardware_survey_recipients: { data: { user_id: 's1' }, error: null },
      hardware_surveys: { data: { closed_at: null }, error: null },
      hardware_survey_responses: { data: null, error: null },
    })
    const input = { ...emptyCheckinInput(), hasLaptop: true, laptopSerial: ' ABC123 ' }
    expect(await submitMyHardwareCheckin('sv', input)).toEqual({ ok: true })
    const upsert = log.find(([m]) => m === 'upsert')!
    expect(upsert[1][0]).toMatchObject({ survey_id: 'sv', user_id: 's1', has_laptop: true, laptop_serial: 'ABC123' })
  })

  it('checks the answers before saving', async () => {
    signedInAs('student', 's1')
    expect(await submitMyHardwareCheckin('sv', { ...emptyCheckinInput(), hasLaptop: true })).toMatchObject({ ok: false, error: expect.stringMatching(/serial/) })
  })
})

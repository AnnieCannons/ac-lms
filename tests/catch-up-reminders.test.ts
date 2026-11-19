import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceSupabaseClient: vi.fn(() => ({})) }))
vi.mock('@/lib/slack', () => ({ notifyByEmail: vi.fn(async () => true), slackEscape: (t: string) => t }))
vi.mock('@/lib/airtable', () => ({ fetchAbsencesBetween: vi.fn() }))

import { GET } from '@/app/api/cron/catch-up-reminders/route'
import { runAbsenceAlerts } from '@/lib/class-catch-up-server'
import { notifyByEmail } from '@/lib/slack'
import type { AbsenceRow } from '@/lib/airtable'

const req = (auth?: string, query = '') => ({
  headers: new Headers(auth ? { authorization: auth } : {}),
  nextUrl: new URL(`https://x/api/cron/catch-up-reminders${query}`),
}) as never

// Thenable chain: every method returns the chain; awaiting it resolves to `result`.
function chain(result: unknown, log: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log.push([String(prop), args]); return c }
    },
  })
  return c as never
}

/** `from(table)` hands out that table's results in order (the last one repeats). */
function fakeAdmin(results: Record<string, unknown[]>) {
  const log: [string, unknown[]][] = []
  const used: Record<string, number> = {}
  const admin = {
    from: (table: string) => {
      log.push(['from', [table]])
      const list = results[table] ?? [{ data: null, error: null }]
      const i = Math.min(used[table] ?? 0, list.length - 1)
      used[table] = (used[table] ?? 0) + 1
      return chain(list[i], log)
    },
  }
  return { admin: admin as never, log }
}

const row = (code: string, date: string, blocks: Partial<Record<'blockA' | 'blockB' | 'blockC' | 'blockD', string>>): AbsenceRow => ({
  airtableStudentId: code,
  date,
  record: { id: 'r', date, blockA: null, blockB: null, blockC: null, blockD: null, ...blocks },
})

const now = new Date('2026-10-22T12:10:00Z') // 5:10am PDT
const itp = { id: 'itp', start_date: '2026-10-01', end_date: null, archived: false, is_template: false }

beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 's3cret' })

describe('catch-up cron route', () => {
  it('refuses a request without the cron secret', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
  })

  it('skips outside the 5am Pacific hour', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-22T18:00:00Z') })
    const res = await GET(req('Bearer s3cret'))
    vi.useRealTimers()
    expect(await res.json()).toEqual({ skipped: 'Not the 5am Pacific run' })
  })
})

describe('runAbsenceAlerts', () => {
  it('DMs an absent student once per day with a link to that day, merging blocks', async () => {
    const { admin, log } = fakeAdmin({
      users: [{ data: [{ id: 'u1', name: 'Ana Lopez', email: 'ana@x.org', airtable_student_id: 's121' }] }],
      course_enrollments: [{ data: [{ user_id: 'u1', courses: itp }] }],
      class_absence_alerts: [{ data: [] }, { data: [{ student_id: 'u1' }] }, { data: null }],
      class_catch_up_forms: [{ data: [] }],
    })
    const fetchAbsences = vi.fn(async () => [
      row('S121', '2026-10-21', { blockC: 'Absent' }),
      row('S121', '2026-10-21', { blockD: 'Absent', blockA: 'Present' }),
    ])
    const result = await runAbsenceAlerts(admin, now, fetchAbsences)

    expect(fetchAbsences).toHaveBeenCalledWith('2026-10-19', '2026-10-21')
    expect(result).toMatchObject({ absences: 1, sent: 1, failed: 0, unmatched: 0 })
    expect(notifyByEmail).toHaveBeenCalledOnce()
    const [email, text] = vi.mocked(notifyByEmail).mock.calls[0]
    expect(email).toBe('ana@x.org')
    expect(text).toContain('Blocks C and D on Wednesday, October 21')
    expect(text).toContain('/student/courses/itp/catch-up?date=2026-10-21')
    const upsert = log.find(([m]) => m === 'upsert')
    expect(upsert?.[1][0]).toMatchObject({ student_id: 'u1', absence_date: '2026-10-21', course_id: 'itp', blocks: ['C', 'D'] })
  })

  it('skips days already alerted, and absences covered by a form already sent', async () => {
    const { admin } = fakeAdmin({
      users: [{ data: [
        { id: 'u1', name: 'Ana', email: 'a@x', airtable_student_id: 'S1' },
        { id: 'u2', name: 'Bo', email: 'b@x', airtable_student_id: 'S2' },
      ] }],
      course_enrollments: [{ data: [{ user_id: 'u1', courses: itp }, { user_id: 'u2', courses: itp }] }],
      class_absence_alerts: [{ data: [{ student_id: 'u1', absence_date: '2026-10-21' }] }],
      class_catch_up_forms: [{ data: [{ student_id: 'u2', submitted_at: '2026-10-21T20:00:00Z' }] }],
    })
    const result = await runAbsenceAlerts(admin, now, async () => [
      row('S1', '2026-10-21', { blockA: 'Absent' }),
      row('S2', '2026-10-20', { blockA: 'Absent' }),
    ])
    expect(result).toMatchObject({ alreadyAlerted: 1, alreadySubmitted: 1, sent: 0 })
    expect(notifyByEmail).not.toHaveBeenCalled()
  })

  it('does not DM when another run logged the day first', async () => {
    const { admin } = fakeAdmin({
      users: [{ data: [{ id: 'u1', name: 'Ana', email: 'a@x', airtable_student_id: 'S1' }] }],
      course_enrollments: [{ data: [{ user_id: 'u1', courses: itp }] }],
      class_absence_alerts: [{ data: [] }, { data: [] }],
      class_catch_up_forms: [{ data: [] }],
    })
    const result = await runAbsenceAlerts(admin, now, async () => [row('S1', '2026-10-21', { blockA: 'Absent' })])
    expect(result).toMatchObject({ alreadyAlerted: 1, sent: 0 })
    expect(notifyByEmail).not.toHaveBeenCalled()
  })

  it('counts students with no LMS account or no running course as unmatched', async () => {
    const { admin } = fakeAdmin({
      users: [{ data: [{ id: 'u1', name: 'Ana', email: 'a@x', airtable_student_id: 'S1' }] }],
      course_enrollments: [{ data: [{ user_id: 'u1', courses: { ...itp, archived: true } }] }],
      class_absence_alerts: [{ data: [] }],
      class_catch_up_forms: [{ data: [] }],
    })
    const result = await runAbsenceAlerts(admin, now, async () => [
      row('S1', '2026-10-21', { blockA: 'Absent' }),
      row('S999', '2026-10-21', { blockA: 'Absent' }),
    ])
    expect(result).toMatchObject({ absences: 2, unmatched: 2, sent: 0 })
  })
})

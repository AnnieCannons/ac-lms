import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
const posted: string[] = []
vi.mock('@/lib/slack', () => ({
  slackEscape: (t: string) => t,
  slackPostMessage: vi.fn(async (_channel: string, text: string) => { posted.push(text); return true }),
}))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { void fn() } }))

import { finishOnboardingIfDone } from '@/lib/onboarding-server'

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

type Setup = {
  prework?: boolean
  role?: string
  grades?: ('complete' | 'incomplete' | null)[]
  alreadyClaimed?: boolean
  needs?: { laptop: string; wifi: string } | null
  holding?: string[]
}

/** A fake service client for one Enrollment Readiness course with two counted assignments. */
function db({ prework = true, role = 'student', grades = ['complete', 'complete'], alreadyClaimed = false, needs = null, holding = [] }: Setup) {
  const writes: { table: string; op: string; row: unknown }[] = []
  const admin = {
    from: (table: string) => {
      const log: [string, unknown[]][] = []
      const results: Record<string, unknown> = {
        courses: { data: { id: 'er', name: 'Enrollment Readiness (2027)', is_enrollment_readiness: prework } },
        course_enrollments: { data: { role } },
        modules: { data: [{ id: 'm1', title: 'Welcome', order: 1, published: true }] },
        module_days: { data: [{ id: 'd1', module_id: 'm1', order: 1 }] },
        assignments: {
          data: [
            { id: 'a1', title: 'Checklist', due_date: '2026-11-30', submission_required: true, counts_toward_onboarding: true, is_optional: false, is_bonus: false, order: 1, module_day_id: 'd1' },
            { id: 'a2', title: 'Agreement', due_date: '2026-12-11', submission_required: true, counts_toward_onboarding: true, is_optional: false, is_bonus: false, order: 2, module_day_id: 'd1' },
            { id: 'a3', title: 'Receiving Your Laptop', due_date: '2027-01-08', submission_required: true, counts_toward_onboarding: false, is_optional: false, is_bonus: false, order: 3, module_day_id: 'd1' },
          ],
        },
        submissions: {
          data: grades.map((grade, i) => ({ id: `s${i}`, assignment_id: `a${i + 1}`, student_id: 'st', status: grade ? 'graded' : 'submitted', grade })),
          error: null,
        },
        assignment_overrides: { data: [], error: null },
        hardware_alerts_sent: alreadyClaimed ? { error: { code: '23505', message: 'duplicate' } } : { error: null },
        course_completions: { error: null },
        hardware_student_needs: { data: needs ? [{ student_id: 'st', ...needs }] : [] },
        hardware_devices: { data: holding.map(kind => ({ kind })) },
        hardware_waitlist: { error: null },
        users: { data: { name: 'Jordan Rivera', email: 'jordan@example.com' } },
      }
      const c = chain(results[table] ?? { data: null, error: null }, log)
      return new Proxy({}, {
        get(_, prop) {
          if (['insert', 'upsert', 'update'].includes(String(prop))) {
            return (row: unknown) => { writes.push({ table, op: String(prop), row }); return c }
          }
          return (c as Record<string, unknown>)[prop as string]
        },
      })
    },
  }
  return { admin: admin as never, writes }
}

beforeEach(() => { posted.length = 0 })

describe('finishOnboardingIfDone', () => {
  it('does nothing outside an Enrollment Readiness course', async () => {
    const { admin, writes } = db({ prework: false })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff')).toBe(false)
    expect(writes).toEqual([])
  })

  it('does nothing for someone who isn’t a student there', async () => {
    const { admin, writes } = db({ role: 'ta' })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff')).toBe(false)
    expect(writes).toEqual([])
  })

  it('waits until every counted assignment is marked Complete', async () => {
    const { admin, writes } = db({ grades: ['complete', null] })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff')).toBe(false)
    expect(writes).toEqual([])
    expect(posted).toEqual([])
  })

  it('the first time: ticks Completed, joins the waitlist for what they need and posts in #student-hardware', async () => {
    const { admin, writes } = db({ needs: { laptop: 'needs', wifi: 'hotspot' } })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff')).toBe(true)
    expect(writes.find(w => w.table === 'hardware_alerts_sent')?.row).toEqual({ key: 'onboarding-finished:er:st' })
    expect(writes.find(w => w.table === 'course_completions')?.row).toMatchObject({ course_id: 'er', user_id: 'st', marked_by: 'staff' })
    expect(writes.filter(w => w.table === 'hardware_waitlist').map(w => (w.row as { kind: string }).kind)).toEqual(['laptop', 'hotspot'])
    expect(posted).toHaveLength(1)
    expect(posted[0]).toContain('Jordan Rivera')
    expect(posted[0]).toContain('finished *Enrollment Readiness (2027)* and needs a laptop and a hotspot.')
  })

  it('skips the waitlist for what they already have or don’t need', async () => {
    const { admin, writes } = db({ needs: { laptop: 'own', wifi: 'none' } })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff')).toBe(true)
    expect(writes.filter(w => w.table === 'hardware_waitlist')).toEqual([])
    expect(posted[0]).toMatch(/nothing to ship/)

    const second = db({ needs: null, holding: ['laptop'] })
    await finishOnboardingIfDone(second.admin, 'er', 'st', 'staff')
    expect(second.writes.filter(w => w.table === 'hardware_waitlist')).toEqual([])
  })

  it('runs the finish steps when staff tick Completed by hand, even with work outstanding', async () => {
    const { admin, writes } = db({ grades: ['complete', null] })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff', undefined, { force: true })).toBe(true)
    expect(writes.find(w => w.table === 'hardware_alerts_sent')?.row).toEqual({ key: 'onboarding-finished:er:st' })
    expect(posted).toHaveLength(1)
  })

  it('only acts once per student and course', async () => {
    const { admin, writes } = db({ alreadyClaimed: true })
    expect(await finishOnboardingIfDone(admin, 'er', 'st', 'staff')).toBe(true)
    expect(writes.map(w => w.table)).toEqual(['hardware_alerts_sent'])
    expect(posted).toEqual([])
  })
})

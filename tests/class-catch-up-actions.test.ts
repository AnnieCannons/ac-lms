import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/slack', () => ({ notifyByEmail: vi.fn(async () => true), notifyStaff: vi.fn(async () => undefined), slackEscape: (t: string) => t }))
vi.mock('@/lib/course-access', () => ({
  requireCourseInstructorAccess: vi.fn(),
  isCourseAccessError: (r: object) => 'error' in r,
}))

import { setCatchUpFollowedUp, submitCatchUpForm } from '@/lib/class-catch-up-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { requireCourseInstructorAccess } from '@/lib/course-access'
import { notifyByEmail, notifyStaff } from '@/lib/slack'

function chain(result: unknown, log: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log.push([String(prop), args]); return c }
    },
  })
  return c as never
}

function serviceWith(results: Record<string, unknown[]>) {
  const log: [string, unknown[]][] = []
  const used: Record<string, number> = {}
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      log.push(['from', [table]])
      const list = results[table] ?? [{ data: null, error: null }]
      const i = Math.min(used[table] ?? 0, list.length - 1)
      used[table] = (used[table] ?? 0) + 1
      return chain(list[i], log)
    },
  } as never)
  return log
}

function signedIn(id: string | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: id ? { id } : null } }) },
  } as never)
}

const form = {
  missedBlocks: 'Block A on Wednesday, October 21',
  lecturesMissed: 'Async JS',
  lectureLinks: 'https://example.com/rec',
  assignmentsMissed: 'Promises lab',
  makeupPlan: 'Watch by Friday',
  notes: '',
}

beforeEach(() => vi.clearAllMocks())

describe('submitCatchUpForm', () => {
  it('needs a signed-in user', async () => {
    signedIn(null)
    expect(await submitCatchUpForm('c1', form)).toEqual({ error: 'Please sign in again.' })
  })

  it('rejects a blank required answer before touching the database', async () => {
    signedIn('s1')
    expect(await submitCatchUpForm('c1', { ...form, makeupPlan: ' ' })).toHaveProperty('error')
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('refuses someone who is not a student in the course', async () => {
    signedIn('s1')
    const log = serviceWith({ course_enrollments: [{ data: null }] })
    expect(await submitCatchUpForm('c1', form)).toEqual({ error: 'Only students in this course can submit the catch-up form.' })
    expect(log.some(([m]) => m === 'insert')).toBe(false)
  })

  it('saves the form as the caller and DMs each course instructor to follow up', async () => {
    signedIn('s1')
    const log = serviceWith({
      course_enrollments: [
        { data: { role: 'student' } },
        { data: [{ users: { email: 'teach@x.org' } }, { users: { email: 'teach2@x.org' } }, { users: { email: 'teach@x.org' } }] },
      ],
      class_catch_up_forms: [{ data: { id: 'f1' }, error: null }],
      users: [{ data: { name: 'Ana', email: 'ana@x.org' } }],
      courses: [{ data: { name: 'ITP Fall' } }],
    })
    expect(await submitCatchUpForm('c1', form, '2026-10-21')).toEqual({ ok: true, instructorsNotified: 2 })

    const insert = log.find(([m]) => m === 'insert')
    expect(insert?.[1][0]).toMatchObject({ student_id: 's1', course_id: 'c1', absence_date: '2026-10-21', makeup_plan: 'Watch by Friday', notes: null })
    expect(vi.mocked(notifyByEmail).mock.calls.map(c => c[0])).toEqual(['teach@x.org', 'teach2@x.org'])
    expect(vi.mocked(notifyByEmail).mock.calls[0][1]).toContain('/instructor/courses/c1/catch-up')
  })

  it('drops a bad absence date and falls back to staff when the course has no instructor', async () => {
    signedIn('s1')
    const log = serviceWith({
      course_enrollments: [{ data: { role: 'student' } }, { data: [] }],
      class_catch_up_forms: [{ data: { id: 'f1' }, error: null }],
    })
    expect(await submitCatchUpForm('c1', form, 'not-a-date')).toEqual({ ok: true, instructorsNotified: 0 })
    expect(log.find(([m]) => m === 'insert')?.[1][0]).toMatchObject({ absence_date: null })
    expect(notifyStaff).toHaveBeenCalledOnce()
  })
})

describe('setCatchUpFollowedUp', () => {
  it('checks course access for the form’s own course', async () => {
    serviceWith({ class_catch_up_forms: [{ data: { id: 'f1', course_id: 'c9' } }] })
    vi.mocked(requireCourseInstructorAccess).mockResolvedValue({ error: 'nope', code: 'NOT_STAFF' })
    expect(await setCatchUpFollowedUp('f1', true)).toEqual({ error: 'nope' })
    expect(requireCourseInstructorAccess).toHaveBeenCalledWith('c9')
  })

  it('records who followed up', async () => {
    const log = serviceWith({ class_catch_up_forms: [{ data: { id: 'f1', course_id: 'c9' } }, { error: null }] })
    vi.mocked(requireCourseInstructorAccess).mockResolvedValue({ user: { id: 't1' }, role: 'ta' })
    expect(await setCatchUpFollowedUp('f1', true)).toEqual({ ok: true })
    expect(log.find(([m]) => m === 'update')?.[1][0]).toMatchObject({ followed_up_by: 't1' })
  })
})

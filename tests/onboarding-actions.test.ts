import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/onboarding-access', () => ({ getOnboardingActor: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/onboarding-server', () => ({
  loadCohortStudents: vi.fn(async () => [{ id: 'done-1' }, { id: 'done-2' }, { id: 'working' }]),
  loadCohortProgress: vi.fn(async () => ({
    progress: new Map([['done-1', { finished: true }], ['done-2', { finished: true }], ['working', { finished: false }]]),
  })),
}))

import { addFinishersToNextCourse, setOnboardingNextCourse } from '@/lib/onboarding-actions'
import { getOnboardingActor } from '@/lib/onboarding-access'
import { createServiceSupabaseClient } from '@/lib/supabase/server'

type Op = [string, unknown[]]

/** Fake service client: `courses` rows by id; enrollments already in the next course; writes logged. */
function db(courses: Record<string, Record<string, unknown>>, alreadyIn: string[] = []) {
  const writes: { table: string; op: string; row: unknown }[] = []
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      const ops: Op[] = []
      const result = () => {
        if (table === 'courses') {
          const id = ops.find(([op, args]) => op === 'eq' && args[0] === 'id')?.[1][1] as string
          return { data: courses[id] ?? null, error: null }
        }
        if (table === 'course_enrollments') return { data: alreadyIn.map(user_id => ({ user_id })), error: null }
        return { data: null, error: null }
      }
      const c: unknown = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res)
          return (...args: unknown[]) => {
            ops.push([String(prop), args])
            if (['insert', 'update'].includes(String(prop))) writes.push({ table, op: String(prop), row: args[0] })
            return c
          }
        },
      })
      return c
    },
  } as never)
  return writes
}

const er = { id: 'er', is_enrollment_readiness: true, onboarding_next_course_id: 'tcf' }
const tcf = { id: 'tcf', is_enrollment_readiness: false, is_template: false }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getOnboardingActor).mockResolvedValue({ userId: 'me', name: 'Me', role: 'staff' })
})

describe('setOnboardingNextCourse', () => {
  it('is for staff only', async () => {
    vi.mocked(getOnboardingActor).mockResolvedValue(null)
    expect(await setOnboardingNextCourse('er', 'tcf')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('saves a real next course and refuses another Enrollment Readiness course', async () => {
    let writes = db({ er, tcf, er2: { id: 'er2', is_enrollment_readiness: true } })
    expect(await setOnboardingNextCourse('er', 'tcf')).toEqual({ ok: true })
    expect(writes).toEqual([{ table: 'courses', op: 'update', row: { onboarding_next_course_id: 'tcf' } }])

    writes = db({ er, tcf, er2: { id: 'er2', is_enrollment_readiness: true } })
    expect(await setOnboardingNextCourse('er', 'er2')).toMatchObject({ ok: false })
    expect(writes).toEqual([])
  })

  it('only works on Enrollment Readiness courses', async () => {
    const writes = db({ tcf })
    expect(await setOnboardingNextCourse('tcf', null)).toMatchObject({ ok: false })
    expect(writes).toEqual([])
  })
})

describe('addFinishersToNextCourse', () => {
  it('adds only finished students who aren’t already there', async () => {
    const writes = db({ er, tcf }, ['done-2'])
    expect(await addFinishersToNextCourse('er')).toEqual({ ok: true, added: 1, alreadyThere: 1 })
    expect(writes).toEqual([{ table: 'course_enrollments', op: 'insert', row: [{ course_id: 'tcf', user_id: 'done-1', role: 'student' }] }])
  })

  it('needs the next course picked first', async () => {
    db({ er: { ...er, onboarding_next_course_id: null } })
    expect(await addFinishersToNextCourse('er')).toEqual({ ok: false, error: 'Choose the next course first.' })
  })

  it('is for staff only', async () => {
    vi.mocked(getOnboardingActor).mockResolvedValue(null)
    expect(await addFinishersToNextCourse('er')).toEqual({ ok: false, error: 'Not authorized.' })
  })
})

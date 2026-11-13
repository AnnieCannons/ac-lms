import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const access = { current: { user: { id: 'u1' }, role: 'instructor' } as { user: { id: string }; role: string } | { error: string; code: string } }
vi.mock('@/lib/course-access', () => ({
  requireCourseInstructorAccess: async () => access.current,
  isCourseAccessError: (r: object) => 'error' in r,
}))

// Minimal chainable fake of the service client, recording writes
const db = {
  existing: null as null | { id: string; course_id: string | null; platform: string; order: number },
  inserted: [] as Record<string, unknown>[],
  updated: [] as Record<string, unknown>[],
  deleted: [] as string[],
}
function query(table: string) {
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: Record<string, unknown> | null = null
  const q: Record<string, unknown> = {}
  const self = () => q
  Object.assign(q, {
    select: self, eq: (col: string, val: unknown) => { if (op === 'delete' && col === 'id') db.deleted.push(val as string); return q },
    is: self, or: self, order: self, limit: self,
    insert: (row: Record<string, unknown>) => { op = 'insert'; payload = row; return q },
    update: (row: Record<string, unknown>) => { op = 'update'; db.updated.push(row); return q },
    delete: () => { op = 'delete'; return q },
    maybeSingle: async () => ({ data: op === 'select' && table === 'level_up_links' ? db.existing : null }),
    single: async () => {
      if (op === 'insert') { db.inserted.push(payload!); return { data: { id: 'new', ...payload, published: true }, error: null } }
      return { data: null, error: null }
    },
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  })
  return q
}
vi.mock('@/lib/supabase/server', () => ({ createServiceSupabaseClient: () => ({ from: query }) }))

import { createLevelUpLink, updateLevelUpLink, deleteLevelUpLink } from '@/lib/level-up-actions'

const COURSE = '33c8da20-08e5-4671-8b96-ff98bbd627df'
const base = { courseId: COURSE, platform: 'codecademy', title: 'Learn JavaScript', url: 'https://www.codecademy.com/learn/introduction-to-javascript' }

beforeEach(() => {
  access.current = { user: { id: 'u1' }, role: 'instructor' }
  Object.assign(db, { existing: null, inserted: [], updated: [], deleted: [] })
})

describe('level-up-actions permissions', () => {
  it('instructors can add shared links (course_id null)', async () => {
    const r = await createLevelUpLink({ ...base, shared: true })
    expect(r.error).toBeUndefined()
    expect(db.inserted[0]).toMatchObject({ course_id: null, platform: 'codecademy', title: 'Learn JavaScript', created_by: 'u1' })
  })

  it('TAs can add links for their course but not shared ones', async () => {
    access.current = { user: { id: 'ta1' }, role: 'ta' }
    expect((await createLevelUpLink({ ...base, shared: true })).error).toMatch(/Only instructors and staff/)
    expect(db.inserted).toHaveLength(0)
    expect((await createLevelUpLink({ ...base, shared: false })).error).toBeUndefined()
    expect(db.inserted[0]).toMatchObject({ course_id: COURSE })
  })

  it('TAs cannot edit or delete an existing shared link', async () => {
    access.current = { user: { id: 'ta1' }, role: 'ta' }
    db.existing = { id: 'l1', course_id: null, platform: 'udemy', order: 0 }
    expect((await updateLevelUpLink('l1', COURSE, { title: 'x' })).error).toMatch(/Only instructors and staff/)
    expect((await deleteLevelUpLink('l1', COURSE)).error).toMatch(/Only instructors and staff/)
    expect(db.updated).toHaveLength(0)
    expect(db.deleted).toHaveLength(0)
  })

  it("a link from a different course can't be changed through this course", async () => {
    db.existing = { id: 'l2', course_id: 'other-course', platform: 'udemy', order: 0 }
    expect((await deleteLevelUpLink('l2', COURSE)).error).toBe('Link not found')
    expect(db.deleted).toHaveLength(0)
  })

  it('people without course access are refused', async () => {
    access.current = { error: 'Not authorized', code: 'NOT_STAFF' }
    expect((await createLevelUpLink({ ...base, shared: false })).error).toBe('Not authorized')
  })
})

describe('level-up-actions validation', () => {
  it.each([
    ['', 'https://x.com', /title/i],
    ['Course', 'codecademy.com/learn', /https:\/\//],
    ['Course', 'javascript:alert(1)', /https:\/\//],
  ])('rejects title=%j url=%j', async (title, url, msg) => {
    expect((await createLevelUpLink({ ...base, shared: false, title, url })).error).toMatch(msg)
    expect(db.inserted).toHaveLength(0)
  })

  it('rejects an unknown platform', async () => {
    expect((await createLevelUpLink({ ...base, shared: false, platform: 'myspace' })).error).toBe('Pick a platform')
  })
})

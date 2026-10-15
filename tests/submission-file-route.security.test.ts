import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/course-scope', () => ({ getAssignmentCourseId: vi.fn() }))

import { GET } from '@/app/api/submission-file/route'
import { getAssignmentCourseId } from '@/lib/course-scope'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

function chain(result: unknown) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return () => c
    },
  })
  return c as never
}

const createSignedUrl = vi.fn()

function setup(userId: string | null, tables: Record<string, unknown> = {}) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
  } as never)
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => chain(tables[table] ?? { data: null }),
    storage: { from: () => ({ createSignedUrl }) },
  } as never)
}

function get(path: string) {
  return GET(new NextRequest(`http://localhost/api/submission-file?path=${encodeURIComponent(path)}`))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssignmentCourseId).mockResolvedValue('c1')
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://abc.supabase.co/signed/x?token=t' }, error: null })
})

describe('GET /api/submission-file', () => {
  it('requires login', async () => {
    setup(null)
    expect((await get('a1/s1/shot.png')).status).toBe(401)
  })

  it('lets the student who uploaded it see it, via a short-lived signed URL', async () => {
    setup('s1')
    const res = await get('a1/s1/shot.png')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://abc.supabase.co/signed/x?token=t')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(createSignedUrl).toHaveBeenCalledWith('a1/s1/shot.png', 300)
  })

  it('works for paths with the random upload folder', async () => {
    setup('s1')
    expect((await get('a1/s1/0a1b2c3d/report.pdf')).status).toBe(302)
    expect(createSignedUrl).toHaveBeenCalledWith('a1/s1/0a1b2c3d/report.pdf', 300)
  })

  it('hides another student\'s file', async () => {
    setup('s2', { users: { data: { role: 'student' } }, course_enrollments: { data: { role: 'student' } } })
    expect((await get('a1/s1/shot.png')).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it.each(['instructor', 'staff', 'admin'])('lets %s see any student\'s file', async role => {
    setup('t1', { users: { data: { role } } })
    expect((await get('a1/s1/shot.png')).status).toBe(302)
  })

  it('lets a TA of the assignment\'s course see it', async () => {
    setup('ta1', { users: { data: { role: 'student' } }, course_enrollments: { data: { role: 'ta' } } })
    expect((await get('a1/s1/shot.png')).status).toBe(302)
  })

  it('hides it from a TA who is not in that course', async () => {
    setup('ta1', { users: { data: { role: 'student' } }, course_enrollments: { data: null } })
    expect((await get('a1/s1/shot.png')).status).toBe(404)
  })

  it('lets a student see a legacy file attached to their own submission from another folder', async () => {
    setup('s2', {
      users: { data: { role: 'student' } },
      course_enrollments: { data: { role: 'student' } },
      submissions: { data: [{ content: JSON.stringify(['https://abc.supabase.co/storage/v1/object/public/lms-submissions/a1/s1/shot.png']) }] },
      submission_history: { data: [] },
    })
    expect((await get('a1/s1/shot.png')).status).toBe(302)
  })

  it('rejects path traversal', async () => {
    setup('s1')
    expect((await get('a1/s1/../../x/y.png')).status).toBe(404)
    expect((await get('/a1/s1/shot.png')).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})

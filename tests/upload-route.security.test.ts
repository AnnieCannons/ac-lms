import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))

import { POST } from '@/app/api/upload/route'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

const createSignedUploadUrl = vi.fn(async (path: string) => ({ data: { path, token: 't' }, error: null }))
const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/b/${path}` } }))

function signedInAs(role: string) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'stu1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) }),
  } as never)
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    storage: { from: () => ({ createSignedUploadUrl, getPublicUrl }) },
  } as never)
}

const req = (body: object) => new Request('http://localhost/api/upload', { method: 'POST', body: JSON.stringify(body) }) as never

beforeEach(() => vi.clearAllMocks())

describe('/api/upload', () => {
  it('puts each submission file in its own folder and never overwrites', async () => {
    signedInAs('student')
    const res = await POST(req({ bucket: 'lms-submissions', path: 'a1/stu1/report.pdf', size: 100, type: 'application/pdf' }))
    expect(res.status).toBe(200)
    const [path, opts] = createSignedUploadUrl.mock.calls[0] as unknown as [string, { upsert: boolean }]
    expect(path).toMatch(/^a1\/stu1\/[0-9a-f]{8}\/report\.pdf$/)
    expect(opts).toEqual({ upsert: false })
    const json = await res.json()
    expect(json.url.endsWith(`/${path}`)).toBe(true)
  })

  it('a second upload of the same name gets a different path', async () => {
    signedInAs('student')
    const body = { bucket: 'lms-submissions', path: 'a1/stu1/report.pdf', size: 100, type: 'application/pdf' }
    await POST(req(body))
    await POST(req(body))
    expect(createSignedUploadUrl.mock.calls[0][0]).not.toEqual(createSignedUploadUrl.mock.calls[1][0])
  })

  it('rejects SVG in submissions but allows PNG', async () => {
    signedInAs('student')
    const svg = await POST(req({ bucket: 'lms-submissions', path: 'a1/stu1/x.svg', size: 100, type: 'image/svg+xml' }))
    expect(svg.status).toBe(415)
    const png = await POST(req({ bucket: 'lms-submissions', path: 'a1/stu1/x.png', size: 100, type: 'image/png' }))
    expect(png.status).toBe(200)
  })

  it('still refuses a student uploading under someone else', async () => {
    signedInAs('student')
    const res = await POST(req({ bucket: 'lms-submissions', path: 'a1/other/x.png', size: 100, type: 'image/png' }))
    expect(res.status).toBe(403)
  })
})

describe('/api/upload — TA resource uploads', () => {
  const DAY = '11111111-1111-4111-8111-111111111111'
  const MOD = '22222222-2222-4222-8222-222222222222'
  const MINE = '33333333-3333-4333-8333-333333333333'
  const OTHER = '44444444-4444-4444-8444-444444444444'

  // Minimal service client: module_days → modules → course, plus TA enrollments.
  function signedInAsTaOf(taCourseIds: string[], dayCourse = MINE, moduleCourse = MINE) {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'ta1' } } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: 'student' } }) }) }) }),
    } as never)
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      storage: { from: () => ({ createSignedUploadUrl, getPublicUrl }) },
      from: (table: string) => {
        const filters: Record<string, string> = {}
        const q = {
          select: () => q,
          eq: (col: string, val: string) => { filters[col] = val; return q },
          single: async () => {
            if (table === 'module_days') return { data: filters.id === DAY ? { module_id: 'day-mod' } : null }
            if (table === 'modules') return { data: { course_id: filters.id === 'day-mod' ? dayCourse : moduleCourse } }
            return { data: null }
          },
          maybeSingle: async () => ({
            data: table === 'course_enrollments' && filters.user_id === 'ta1' && taCourseIds.includes(filters.course_id) ? { role: 'ta' } : null,
          }),
        }
        return q
      },
    } as never)
  }

  const upload = (path: string) => POST(req({ bucket: 'lms-resources', path, size: 100, type: 'application/pdf' }))

  it.each([
    ['a module day', `module-day-${DAY}/notes.pdf`],
    ['a module', `module-${MOD}/notes.pdf`],
    ['a new module (course path)', `course-${MINE}/notes.pdf`],
    ['a quiz image', `quizzes/${MINE}/quiz-1/notes.pdf`],
  ])('lets a TA upload for %s in their own course', async (_, path) => {
    signedInAsTaOf([MINE])
    expect((await upload(path)).status).toBe(200)
  })

  it.each([
    ['a module day', `module-day-${DAY}/notes.pdf`],
    ['a module', `module-${MOD}/notes.pdf`],
    ['a course path', `course-${OTHER}/notes.pdf`],
    ['a quiz image', `quizzes/${OTHER}/quiz-1/notes.pdf`],
  ])("refuses a TA uploading for %s in a course they don't TA", async (_, path) => {
    signedInAsTaOf([MINE], OTHER, OTHER)
    expect((await upload(path)).status).toBe(403)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it.each(['module-new/notes.pdf', 'notes.pdf', `flashcard-images/${MINE}/x.pdf`, 'module-day-not-a-uuid/x.pdf'])(
    'refuses a TA upload whose path names no course (%s)',
    async path => {
      signedInAsTaOf([MINE])
      expect((await upload(path)).status).toBe(403)
    },
  )

  it('still refuses a plain student uploading course files', async () => {
    signedInAsTaOf([])
    expect((await upload(`course-${MINE}/notes.pdf`)).status).toBe(403)
  })
})

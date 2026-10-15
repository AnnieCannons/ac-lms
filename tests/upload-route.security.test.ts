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

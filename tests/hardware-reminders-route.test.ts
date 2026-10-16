import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/hardware-reminders-server', () => ({ runHardwareReminders: vi.fn(async () => ({ ok: true })) }))

import { GET } from '@/app/api/cron/hardware-reminders/route'
import { runHardwareReminders } from '@/lib/hardware-reminders-server'

const req = (auth?: string, query = '') => ({
  headers: new Headers(auth ? { authorization: auth } : {}),
  nextUrl: new URL(`https://x/api/cron/hardware-reminders${query}`),
}) as never

beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 's3cret' })

describe('hardware reminders cron', () => {
  it('refuses a request without the cron secret', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(runHardwareReminders).not.toHaveBeenCalled()
  })

  it('runs with the secret (anyHour skips the 8am Pacific gate)', async () => {
    const res = await GET(req('Bearer s3cret', '?anyHour=1'))
    expect(res.status).toBe(200)
    expect(runHardwareReminders).toHaveBeenCalledOnce()
  })
})

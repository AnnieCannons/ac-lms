import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/hardware-tickets-server', () => ({
  createTicketFromPayload: vi.fn(async () => ({ ticketId: 't1', duplicate: false, studentMatched: true, deviceMatched: true })),
}))

import { POST } from '@/app/api/webhooks/hardware-ticket/route'
import { createTicketFromPayload } from '@/lib/hardware-tickets-server'

const req = (body: unknown, secret?: string) => ({
  headers: new Headers(secret ? { 'x-webhook-secret': secret } : {}),
  json: async () => { if (body === 'not json') throw new Error('bad'); return body },
}) as never

beforeEach(() => { vi.clearAllMocks(); process.env.HARDWARE_TICKET_WEBHOOK_SECRET = 'shh' })

describe('hardware ticket webhook', () => {
  it('refuses requests without the right secret', async () => {
    expect((await POST(req({ recordId: 'recAbc123' }))).status).toBe(401)
    expect((await POST(req({ recordId: 'recAbc123' }, 'nope'))).status).toBe(401)
    expect(createTicketFromPayload).not.toHaveBeenCalled()
  })

  it('fails closed when the secret is not configured', async () => {
    delete process.env.HARDWARE_TICKET_WEBHOOK_SECRET
    expect((await POST(req({ recordId: 'recAbc123' }, 'anything'))).status).toBe(401)
  })

  it('rejects bad JSON and a missing record id', async () => {
    expect((await POST(req('not json', 'shh'))).status).toBe(400)
    expect((await POST(req({ email: 'a@b.c' }, 'shh'))).status).toBe(400)
  })

  it('creates the ticket without passing on anything but the known fields', async () => {
    const res = await POST(req({ recordId: 'recAbc123', email: 'A@B.org', equipment: 'Laptop', issue: 'Broken', streetAddress: '1 Main St' }, 'shh'))
    expect(res.status).toBe(200)
    const payload = vi.mocked(createTicketFromPayload).mock.calls[0][1]
    expect(payload).toMatchObject({ recordId: 'recAbc123', email: 'a@b.org', equipment: 'Laptop', issue: 'Broken' })
    expect(JSON.stringify(payload)).not.toMatch(/Main St/)
  })
})

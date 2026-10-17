import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { parseTicketPayload } from '@/lib/hardware-tickets'
import { createTicketFromPayload } from '@/lib/hardware-tickets-server'

// Equipment Support Form → ticket. Called by the Airtable automation's script with the
// shared secret in `x-webhook-secret` (HARDWARE_TICKET_WEBHOOK_SECRET). Fails closed: with
// the secret unset every request is refused. The shipping address is never sent here.

function hasValidSecret(got: string | null): boolean {
  const expected = process.env.HARDWARE_TICKET_WEBHOOK_SECRET
  if (!expected || !got) return false
  // Compare digests so neither the length nor the content leaks through timing.
  const a = createHash('sha256').update(got).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!hasValidSecret(req.headers.get('x-webhook-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const payload = parseTicketPayload(body)
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 })

  try {
    const result = await createTicketFromPayload(createServiceSupabaseClient(), payload)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('hardware-ticket webhook failed', err)
    return NextResponse.json({ error: 'Could not save the ticket.' }, { status: 500 })
  }
}

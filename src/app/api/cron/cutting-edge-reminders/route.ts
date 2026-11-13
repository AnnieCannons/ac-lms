import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { runCuttingEdgeReminders } from '@/lib/cutting-edge-server'
import { pacificParts, REMINDER_HOUR_PACIFIC } from '@/lib/cutting-edge'
import { timingSafeEqual } from 'crypto'

function verifyCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader) return false
  const expected = `Bearer ${secret}`
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

// Cutting Edge Talks reminders at 8:30am Pacific. Vercel crons run in UTC, so this is
// scheduled at both 15:30 and 16:30 UTC and only does work on the run that lands in the
// 8am Pacific hour (PDT vs PST). The sent-log makes a second run a no-op anyway.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Testing hooks: ?anyHour=1 skips the 8am Pacific gate; ?eventId= limits to one event.
  const anyHour = req.nextUrl.searchParams.get('anyHour') === '1'
  const onlyEventId = req.nextUrl.searchParams.get('eventId') ?? undefined

  const now = new Date()
  if (!anyHour && pacificParts(now).hour !== REMINDER_HOUR_PACIFIC) {
    return NextResponse.json({ skipped: 'Not the 8am Pacific run' })
  }

  try {
    const result = await runCuttingEdgeReminders(createServiceSupabaseClient(), now, onlyEventId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('cutting-edge-reminders failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

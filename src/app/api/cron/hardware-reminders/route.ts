import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { runHardwareReminders } from '@/lib/hardware-reminders-server'
import { pacificParts, REMINDER_HOUR_PACIFIC } from '@/lib/cutting-edge'

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

// Hardware reminders at 8:30am Pacific: hotspot renewals, student return reminders,
// likely-lost alerts and the break-time graduate review. Like the Cutting Edge reminders,
// it's scheduled at 15:30 and 16:30 UTC and only works on the run in the 8am Pacific hour;
// everything it sends is logged first, so a repeat run is a no-op anyway.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  if (req.nextUrl.searchParams.get('anyHour') !== '1' && pacificParts(now).hour !== REMINDER_HOUR_PACIFIC) {
    return NextResponse.json({ skipped: 'Not the 8am Pacific run' })
  }
  try {
    return NextResponse.json(await runHardwareReminders(createServiceSupabaseClient(), now))
  } catch (err) {
    console.error('hardware-reminders failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { runAbsenceAlerts } from '@/lib/class-catch-up-server'
import { CATCH_UP_HOUR_PACIFIC } from '@/lib/class-catch-up'
import { pacificParts } from '@/lib/cutting-edge'

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

// Class Catch Up Form DMs at 5am Pacific: every student marked Absent in Airtable in the
// last few days gets a Slack DM linking to the catch-up form, once per absent day.
// Vercel crons run in UTC, so this is scheduled at 12:00 and 13:00 UTC and only does work
// on the run in the 5am Pacific hour (PDT vs PST); the sent-log makes a repeat a no-op.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  if (req.nextUrl.searchParams.get('anyHour') !== '1' && pacificParts(now).hour !== CATCH_UP_HOUR_PACIFIC) {
    return NextResponse.json({ skipped: 'Not the 5am Pacific run' })
  }
  try {
    return NextResponse.json(await runAbsenceAlerts(createServiceSupabaseClient(), now))
  } catch (err) {
    console.error('catch-up-reminders failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

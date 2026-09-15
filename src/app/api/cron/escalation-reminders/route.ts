import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { runEscalationReminders } from '@/lib/readiness'
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

// Runs every few hours: nudges the track's student-monitor channel for any
// step1/step2 student who hasn't completed their check-in within 48 hours.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Testing hook: pass ?cutoffHours=0 to bypass the real 48h wait when
  // walking a test student through the reminder flow.
  const cutoffParam = req.nextUrl.searchParams.get('cutoffHours')
  const cutoffHours = cutoffParam ? Number(cutoffParam) : 48
  if (cutoffParam && (isNaN(cutoffHours) || cutoffHours < 0)) {
    return NextResponse.json({ error: 'Invalid cutoffHours' }, { status: 400 })
  }

  // Testing hook: scope to a single course so a test run can't touch real
  // students' escalation states.
  const onlyCourseId = req.nextUrl.searchParams.get('courseId') ?? undefined

  const admin = createServiceSupabaseClient()
  const result = await runEscalationReminders(admin, cutoffHours, onlyCourseId)
  return NextResponse.json(result)
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { runReadinessJob } from '@/lib/readiness'
import { getCurrentEtHour } from '@/lib/weekly-report'
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

// Runs Monday morning: scores every student for the week that just ended,
// using backlog counts measured live (post-weekend) rather than frozen at
// Thursday's end, so weekend catch-up counts in the student's favor.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const asOfParam = req.nextUrl.searchParams.get('asOf')
  const now = asOfParam ? new Date(asOfParam) : new Date()
  if (asOfParam && isNaN(now.getTime())) {
    return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 })
  }

  const etHour = getCurrentEtHour(new Date())
  const force = req.nextUrl.searchParams.get('force') === 'true' || !!asOfParam
  if (etHour !== 9 && !force) {
    return NextResponse.json({ skipped: true, reason: `not 9am ET (currently ${etHour}:00 ET)` })
  }

  // Testing hook: scope to a single course so a test run against a fake
  // asOf/force can never touch a real, currently-active course.
  const onlyCourseId = req.nextUrl.searchParams.get('courseId') ?? undefined

  const admin = createServiceSupabaseClient()
  const result = await runReadinessJob(admin, now, onlyCourseId)
  return NextResponse.json(result)
}

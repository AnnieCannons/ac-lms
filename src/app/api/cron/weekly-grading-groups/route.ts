import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fillMissingWeeklyGroupsAllCourses } from '@/lib/weekly-rotation'
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

// Runs daily: for every course with weekly grading rotation on, generates the
// rotated groups for any week published since rotation was enabled, so graders'
// "my group" views are right without anyone opening the Grading Groups page.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceSupabaseClient()
  const result = await fillMissingWeeklyGroupsAllCourses(admin)
  return NextResponse.json(result)
}

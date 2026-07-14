import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { slackPostMessage } from '@/lib/slack'
import {
  buildCourseReport,
  detectTrack,
  formatReportMessage,
  getCurrentEtHour,
  getWeekRanges,
  isCurrentCourse,
  resolveAirtableCourseName,
  TRACK_CHANNELS,
} from '@/lib/weekly-report'
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

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const etHour = getCurrentEtHour(now)
  const force = req.nextUrl.searchParams.get('force') === 'true'
  if (etHour !== 9 && !force) {
    return NextResponse.json({ skipped: true, reason: `not 9am ET (currently ${etHour}:00 ET)` })
  }

  const admin = createServiceSupabaseClient()

  const { data: courses, error } = await admin
    .from('courses')
    .select('id, name, start_date, end_date, is_template, archived, airtable_course_name')

  if (error) {
    console.error('weekly-report: failed to fetch courses', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const weekRanges = getWeekRanges(now)
  const sent: string[] = []
  const failed: string[] = []

  for (const course of courses ?? []) {
    if (course.is_template || course.archived) continue
    if (!isCurrentCourse(course.start_date, course.end_date)) continue

    const track = detectTrack(course.name, course.airtable_course_name)
    if (!track) continue

    const airtableCourseName = resolveAirtableCourseName(course, courses ?? [])
    const report = await buildCourseReport(
      admin,
      { id: course.id, name: course.name, airtableCourseName },
      weekRanges,
    )
    const message = formatReportMessage(course.name, report)
    const ok = await slackPostMessage(TRACK_CHANNELS[track], message)
    if (ok) sent.push(course.name)
    else failed.push(course.name)
  }

  return NextResponse.json({ sent, failed })
}

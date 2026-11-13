import { NextRequest, NextResponse } from 'next/server'
import { getAttendanceAccess, canSeeClass } from '@/lib/attendance-access'
import { fetchClassAttendance } from '@/lib/airtable'

export async function GET(req: NextRequest) {
  const access = await getAttendanceAccess()
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const className = req.nextUrl.searchParams.get('name')
  if (!className) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 })
  }
  // TAs only see the classes linked to the courses they TA
  if (!canSeeClass(access, className)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const students = await fetchClassAttendance(className)
    return NextResponse.json({ students })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('fetchClassAttendance error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getAttendanceAccess, filterClasses } from '@/lib/attendance-access'
import { fetchActiveClasses } from '@/lib/airtable'

export async function GET() {
  const access = await getAttendanceAccess()
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const classes = filterClasses(access, await fetchActiveClasses())
    return NextResponse.json({ classes })
  } catch (err) {
    console.error('fetchActiveClasses error:', err)
    return NextResponse.json({ error: 'Failed to load classes' }, { status: 500 })
  }
}

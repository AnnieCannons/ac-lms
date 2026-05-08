import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchClassAttendance } from '@/lib/airtable'

async function isInstructorOrTa(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'instructor' || profile?.role === 'admin') return true

  const { data: ta } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'ta')
    .limit(1)
    .maybeSingle()

  return !!ta
}

export async function GET(req: NextRequest) {
  if (!(await isInstructorOrTa())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const className = req.nextUrl.searchParams.get('name')
  if (!className) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 })
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

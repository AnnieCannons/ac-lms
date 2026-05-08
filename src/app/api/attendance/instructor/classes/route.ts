import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchActiveClasses } from '@/lib/airtable'

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

export async function GET() {
  if (!(await isInstructorOrTa())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const classes = await fetchActiveClasses()
    return NextResponse.json({ classes })
  } catch (err) {
    console.error('fetchActiveClasses error:', err)
    return NextResponse.json({ error: 'Failed to load classes' }, { status: 500 })
  }
}

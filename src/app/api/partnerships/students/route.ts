import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchAllAirtableStudentNames } from '@/lib/airtable'

async function isStaffOrAdmin(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'staff' || profile?.role === 'admin'
}

export async function GET() {
  if (!(await isStaffOrAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const names = await fetchAllAirtableStudentNames()
    return NextResponse.json({ names: [...new Set(names)].sort() })
  } catch (err) {
    console.error('fetchAllAirtableStudentNames error:', err)
    return NextResponse.json({ error: 'Failed to load student names' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchStudentAttendance } from '@/lib/airtable'

async function isInstructorOrAdmin(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return profile?.role === 'instructor' || profile?.role === 'admin'
}

export async function GET(req: NextRequest) {
  if (!(await isInstructorOrAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  try {
    const records = await fetchStudentAttendance(name)

    let absences = 0
    let tardies = 0
    let totalBlocks = 0

    for (const r of records) {
      for (const block of [r.blockA, r.blockB, r.blockC, r.blockD]) {
        if (!block) continue
        totalBlocks++
        if (block.includes('Absent')) absences++
        else if (block.includes('Tardy')) tardies++
      }
    }

    const percentMissed = totalBlocks > 0 ? (absences / totalBlocks) * 100 : null

    return NextResponse.json({ absences, tardies, totalBlocks, percentMissed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

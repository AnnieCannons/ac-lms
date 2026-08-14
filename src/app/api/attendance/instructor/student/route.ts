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

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Monday of the week containing this date, as a YYYY-MM-DD string. */
function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return formatDateStr(d)
}

export async function GET(req: NextRequest) {
  if (!(await isInstructorOrAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const since = req.nextUrl.searchParams.get('since') ?? undefined
  const until = req.nextUrl.searchParams.get('until') ?? undefined
  const courseName = req.nextUrl.searchParams.get('courseName') ?? undefined

  try {
    const records = await fetchStudentAttendance(name, since, until, courseName)

    let absences = 0
    let tardies = 0
    let totalBlocks = 0
    const weeklyMap = new Map<string, { absences: number; tardies: number }>()

    for (const r of records) {
      const week = r.date ? weekStartOf(r.date) : null
      for (const block of [r.blockA, r.blockB, r.blockC, r.blockD]) {
        if (!block) continue
        totalBlocks++
        const isAbsent = block.includes('Absent')
        const isTardy = !isAbsent && block.includes('Tardy')
        if (isAbsent) absences++
        else if (isTardy) tardies++

        if (week && (isAbsent || isTardy)) {
          const entry = weeklyMap.get(week) ?? { absences: 0, tardies: 0 }
          if (isAbsent) entry.absences++
          else entry.tardies++
          weeklyMap.set(week, entry)
        }
      }
    }

    const percentMissed = totalBlocks > 0 ? (absences / totalBlocks) * 100 : null

    const history = Array.from(weeklyMap.entries())
      .map(([weekStart, counts]) => ({ weekStart, ...counts }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))

    return NextResponse.json({ absences, tardies, totalBlocks, percentMissed, history })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

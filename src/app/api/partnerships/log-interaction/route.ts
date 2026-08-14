import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { scheduleSlackDM } from '@/lib/slack'
import { normalizeDepartments, normalizeRemindDays } from '@/lib/partnerships/addon-multi-select'

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-addon-api-key')
  return !!(process.env.ADDON_API_KEY && key === process.env.ADDON_API_KEY)
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { partner_id, note, interaction_date, contact_id, user_email } = body
  if (!partner_id || !note || !interaction_date || !user_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const departments = normalizeDepartments(body)
  const remindDaysList = normalizeRemindDays(body)

  const supabase = createServiceSupabaseClient()

  const { data: userRow } = await supabase
    .from('users')
    .select('id, slack_email')
    .eq('email', user_email)
    .in('role', ['staff', 'admin'])
    .maybeSingle()

  if (!userRow) {
    return NextResponse.json({ error: 'No staff/admin account found for this email' }, { status: 403 })
  }

  const soonestDays = remindDaysList.length > 0 ? Math.min(...remindDaysList) : null
  const reminderAt = soonestDays
    ? new Date(Date.now() + soonestDays * 86400 * 1000).toISOString().slice(0, 10)
    : null

  const departmentValues = departments.length > 0 ? departments : [null]
  const { error: dbError } = await supabase.from('partner_interactions').insert(
    departmentValues.map((department) => ({
      partner_id,
      note,
      interaction_date,
      contact_id: contact_id || null,
      department,
      reminder_days: soonestDays,
      reminder_at: reminderAt,
      user_id: userRow.id,
    }))
  )
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Move last_interaction_date forward only
  await supabase
    .from('partners')
    .update({ last_interaction_date: interaction_date })
    .eq('id', partner_id)
    .or(`last_interaction_date.is.null,last_interaction_date.lt.${interaction_date}`)

  if (remindDaysList.length > 0) {
    const { data: partner } = await supabase.from('partners').select('name').eq('id', partner_id).single()
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    for (const days of remindDaysList) {
      const postAt = Math.floor(Date.now() / 1000) + days * 86400
      await scheduleSlackDM(
        userRow.slack_email || user_email,
        `⏰ Follow-up reminder: ${partner?.name ?? 'partner'}\n${APP_URL}/instructor/partnerships/${partner_id}`,
        postAt
      )
    }
  }

  return NextResponse.json({ success: true })
}

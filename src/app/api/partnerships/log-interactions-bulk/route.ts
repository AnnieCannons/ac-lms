import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { scheduleSlackDM } from '@/lib/slack'

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-addon-api-key')
  return !!(process.env.ADDON_API_KEY && key === process.env.ADDON_API_KEY)
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { partner_id, contact_id, department, remind_in_days, user_email, interactions } = await req.json()
  if (!partner_id || !user_email || !Array.isArray(interactions) || interactions.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (interactions.some((i) => !i.note || !i.interaction_date)) {
    return NextResponse.json({ error: 'Each interaction needs a note and interaction_date' }, { status: 400 })
  }

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

  const days = Number(remind_in_days) > 0 ? Number(remind_in_days) : null
  const reminderAt = days
    ? new Date(Date.now() + days * 86400 * 1000).toISOString().slice(0, 10)
    : null

  const { error: dbError } = await supabase.from('partner_interactions').insert(
    interactions.map((i: { note: string; interaction_date: string }) => ({
      partner_id,
      note: i.note,
      interaction_date: i.interaction_date,
      contact_id: contact_id || null,
      department: department || null,
      reminder_days: days,
      reminder_at: reminderAt,
      user_id: userRow.id,
    }))
  )
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const latestDate = interactions
    .map((i: { interaction_date: string }) => i.interaction_date)
    .sort()
    .at(-1)

  // Move last_interaction_date forward only
  await supabase
    .from('partners')
    .update({ last_interaction_date: latestDate })
    .eq('id', partner_id)
    .or(`last_interaction_date.is.null,last_interaction_date.lt.${latestDate}`)

  if (days) {
    const { data: partner } = await supabase.from('partners').select('name').eq('id', partner_id).single()
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const postAt = Math.floor(Date.now() / 1000) + days * 86400
    await scheduleSlackDM(
      userRow.slack_email || user_email,
      `⏰ Follow-up reminder: ${partner?.name ?? 'partner'}\n${APP_URL}/instructor/partnerships/${partner_id}`,
      postAt
    )
  }

  return NextResponse.json({ success: true, count: interactions.length })
}

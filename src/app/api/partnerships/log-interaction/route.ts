import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { scheduleSlackDM } from '@/lib/slack'

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-addon-api-key')
  return !!(process.env.ADDON_API_KEY && key === process.env.ADDON_API_KEY)
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { partner_id, note, interaction_date, remind_in_days, contact_id, user_email } = await req.json()
  if (!partner_id || !note || !interaction_date || !user_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

  const { error: dbError } = await supabase.from('partner_interactions').insert({
    partner_id,
    note,
    interaction_date,
    contact_id: contact_id || null,
    reminder_days: days,
    reminder_at: reminderAt,
    user_id: userRow.id,
  })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Move last_interaction_date forward only
  await supabase
    .from('partners')
    .update({ last_interaction_date: interaction_date })
    .eq('id', partner_id)
    .or(`last_interaction_date.is.null,last_interaction_date.lt.${interaction_date}`)

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

  return NextResponse.json({ success: true })
}

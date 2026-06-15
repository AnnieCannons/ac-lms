import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { notifyByEmail, scheduleSlackDM } from '@/lib/slack'

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-addon-api-key')
  return !!(process.env.ADDON_API_KEY && key === process.env.ADDON_API_KEY)
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, contact_name, contact_email, note, interaction_date, remind_in_days, user_email } = await req.json()
  if (!name || !note || !interaction_date || !user_email) {
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

  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .insert({ name: name.trim(), status: 'prospect', internal_owner_id: userRow.id })
    .select('id')
    .single()

  if (partnerError || !partner) {
    return NextResponse.json({ error: partnerError?.message ?? 'Failed to create partner' }, { status: 500 })
  }

  const contactName = contact_name?.trim()
  const contactEmail = contact_email?.trim()
  if (contactName || contactEmail) {
    await supabase.from('partner_contacts').insert({
      partner_id: partner.id,
      name: contactName || contactEmail || '',
      email: contactEmail || null,
      is_primary: true,
    })
  }

  const { error: interactionError } = await supabase.from('partner_interactions').insert({
    partner_id: partner.id,
    note,
    interaction_date,
    user_id: userRow.id,
  })
  if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 500 })

  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const slackEmail = userRow.slack_email || user_email

  // Immediate DM so they go complete the profile
  await notifyByEmail(
    slackEmail,
    `🤝 New partner added: *${name.trim()}*\nComplete their profile: ${APP_URL}/instructor/partnerships/${partner.id}`
  )

  const days = Number(remind_in_days)
  if (days > 0) {
    const postAt = Math.floor(Date.now() / 1000) + days * 86400
    await scheduleSlackDM(
      slackEmail,
      `⏰ Follow-up reminder: ${name.trim()}\n${APP_URL}/instructor/partnerships/${partner.id}`,
      postAt
    )
  }

  return NextResponse.json({ success: true, partnerId: partner.id })
}

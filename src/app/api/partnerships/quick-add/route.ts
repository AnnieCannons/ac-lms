import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { notifyByEmail, scheduleSlackDM, scheduleSlackDMs, isSchedulableTime, SLACK_SCHEDULE_MAX_DAYS } from '@/lib/slack'
import { normalizeDepartments, normalizeRemindDays } from '@/lib/partnerships/addon-multi-select'

function checkApiKey(req: NextRequest) {
  const key = req.headers.get('x-addon-api-key')
  return !!(process.env.ADDON_API_KEY && key === process.env.ADDON_API_KEY)
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, contact_name, contact_email, note, interaction_date, remind_at, user_email } = body
  if (!name || !note || !interaction_date || !user_email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const departments = normalizeDepartments(body)
  const remindDaysList = normalizeRemindDays(body)

  // An exact remind_at (ISO datetime) takes priority over the relative remind_in_days list.
  const hasExactReminder = !!remind_at
  const exactPostAt = hasExactReminder ? Math.floor(new Date(remind_at).getTime() / 1000) : null

  if (exactPostAt != null && !isSchedulableTime(exactPostAt)) {
    return NextResponse.json({ error: `Reminder must be in the future and within ${SLACK_SCHEDULE_MAX_DAYS} days.` }, { status: 400 })
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

  const soonestDays = !hasExactReminder && remindDaysList.length > 0 ? Math.min(...remindDaysList) : null
  const reminderAt = hasExactReminder
    ? new Date(remind_at).toISOString()
    : soonestDays
      ? new Date(Date.now() + soonestDays * 86400 * 1000).toISOString()
      : null

  const departmentValues = departments.length > 0 ? departments : [null]
  const { error: interactionError } = await supabase.from('partner_interactions').insert(
    departmentValues.map((department) => ({
      partner_id: partner.id,
      note,
      interaction_date,
      department,
      reminder_days: soonestDays,
      reminder_at: reminderAt,
      user_id: userRow.id,
    }))
  )
  if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 500 })

  if (departments.length > 0) {
    await supabase.from('partner_department_status').insert(
      departments.map((department) => ({
        partner_id: partner.id,
        department,
        stage: '',
        updated_by: userRow.id,
      }))
    )
  }

  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const slackEmail = userRow.slack_email || user_email

  // Immediate DM so they go complete the profile, in parallel with any reminder scheduling
  const notifications: Promise<unknown>[] = [
    notifyByEmail(
      slackEmail,
      `🤝 New partner added: *${name.trim()}*\nComplete their profile: ${APP_URL}/instructor/partnerships/${partner.id}?edit=1`
    ),
  ]

  if (hasExactReminder) {
    notifications.push(
      scheduleSlackDM(
        slackEmail,
        `⏰ Follow-up reminder: ${name.trim()}\n${APP_URL}/instructor/partnerships/${partner.id}`,
        exactPostAt!
      )
    )
  } else if (remindDaysList.length > 0) {
    notifications.push(
      scheduleSlackDMs(
        slackEmail,
        `⏰ Follow-up reminder: ${name.trim()}\n${APP_URL}/instructor/partnerships/${partner.id}`,
        remindDaysList.map((days) => Math.floor(Date.now() / 1000) + days * 86400)
      )
    )
  }

  await Promise.all(notifications)

  return NextResponse.json({ success: true, partnerId: partner.id })
}

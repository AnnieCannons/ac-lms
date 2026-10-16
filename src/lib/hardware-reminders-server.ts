import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { notifyByEmail, slackPostMessage } from '@/lib/slack'
import { daysSince, formatDateOnly, KIND_LABELS, LIKELY_LOST_DAYS, type DeviceKind } from '@/lib/hardware'
import { loadHotspotPlans, loadOpenReturns, type HotspotPlanStatus } from '@/lib/hardware-server'
import {
  breakPeriods,
  daysBetween,
  graduateReviewDue,
  HARDWARE_SLACK_CHANNEL_DEFAULT,
  nextReturnReminderAt,
  pacificToday,
  renewalState,
  returnReminderText,
} from '@/lib/hardware-reminders'

// The daily hardware reminders job (Phase 7), run by /api/cron/hardware-reminders.
// Every alert is recorded (hardware_alerts_sent, or a claimed next_reminder_at) before it
// is sent, so a second run on the same day never sends anything twice.

type Admin = ReturnType<typeof createServiceSupabaseClient>

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com'
const channel = () => process.env.SLACK_HARDWARE_CHANNEL || HARDWARE_SLACK_CHANNEL_DEFAULT
const emailFrom = () => process.env.RESEND_FROM_EMAIL ?? 'AnnieCannons LMS <noreply@mail.anniecannons.com>'

export const RETURN_REMINDER_TYPE = 'hardware_return_reminder'
export const RENEWAL_ALERT_TYPE = 'hardware_renewal'

/** Records `key` as sent; false if it already was (so the caller skips sending). */
async function claimAlert(admin: Admin, key: string): Promise<boolean> {
  const { error } = await admin.from('hardware_alerts_sent').insert({ key })
  return !error
}

/** Staff who get bell notifications for hardware alerts (HARDWARE_ALERT_EMAILS, else STAFF_NOTIFY_EMAIL). */
async function alertStaffIds(admin: Admin): Promise<string[]> {
  const emails = (process.env.HARDWARE_ALERT_EMAILS || process.env.STAFF_NOTIFY_EMAIL || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  if (emails.length === 0) return []
  const { data } = await admin.from('users').select('id, email').in('email', emails)
  return ((data ?? []) as { id: string }[]).map(u => u.id)
}

export type ReminderRunResult = {
  renewalsAlerted: number
  studentsReminded: number
  likelyLostAlerted: number
  graduateReview: string | null
}

export async function runHardwareReminders(admin: Admin, now: Date = new Date()): Promise<ReminderRunResult> {
  const today = pacificToday(now)
  const result: ReminderRunResult = { renewalsAlerted: 0, studentsReminded: 0, likelyLostAlerted: 0, graduateReview: null }
  const staffIds = await alertStaffIds(admin)

  // 1. Hotspot plans ending within 45 days (or already ended): once per plan period.
  const due: HotspotPlanStatus[] = []
  for (const h of await loadHotspotPlans(admin)) {
    if (!h.current || renewalState(h.current.ends_on, today) === 'ok') continue
    if (await claimAlert(admin, `renewal:${h.current.id}`)) due.push(h)
  }
  if (due.length) {
    const lines = due.map(h => {
      const left = daysBetween(today, h.current!.ends_on)
      const when = left < 0 ? `ended ${formatDateOnly(h.current!.ends_on)}` : `ends ${formatDateOnly(h.current!.ends_on)} (${left} days)`
      return `• <${appUrl()}/instructor/hardware/devices/${h.device.id}|${h.device.asset_tag}>${h.holder ? ` (${h.holder.name ?? h.holder.email})` : ''}: ${when}`
    })
    await slackPostMessage(channel(), `📶 *Hotspot plan${due.length === 1 ? '' : 's'} up for renewal*\n${lines.join('\n')}`)
    if (staffIds.length) {
      await admin.from('notifications').insert(staffIds.map(user_id => ({
        user_id, type: RENEWAL_ALERT_TYPE,
        message: `${due.length} hotspot plan${due.length === 1 ? '' : 's'} up for renewal: ${due.map(h => h.device.asset_tag).join(', ')}`,
      })))
    }
    result.renewalsAlerted = due.length
  }

  // 2. Return reminders that are due, grouped per student. Claim each request by moving its
  //    next reminder forward first, so a concurrent run can't send the same reminder.
  const { data: dueRows } = await admin.from('hardware_return_requests')
    .select('id, device_id, student_id, reminder_count')
    .is('closed_at', null).not('student_id', 'is', null).lte('next_reminder_at', now.toISOString())
  const byStudent = new Map<string, string[]>()
  const countByStudent = new Map<string, number>()
  for (const r of (dueRows ?? []) as { id: string; device_id: string; student_id: string; reminder_count: number }[]) {
    const count = r.reminder_count + 1
    const { data: claimed } = await admin.from('hardware_return_requests')
      .update({ reminder_count: count, next_reminder_at: nextReturnReminderAt(count, now).toISOString() })
      .eq('id', r.id).eq('reminder_count', r.reminder_count).select('id')
    if (claimed?.length) {
      byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r.device_id])
      countByStudent.set(r.student_id, Math.max(countByStudent.get(r.student_id) ?? 0, count))
    }
  }
  if (byStudent.size) {
    const [{ data: students }, { data: devices }] = await Promise.all([
      admin.from('users').select('id, name, email').in('id', [...byStudent.keys()]),
      admin.from('hardware_devices').select('id, asset_tag, kind').in('id', [...byStudent.values()].flat()),
    ])
    const deviceById = new Map(((devices ?? []) as { id: string; asset_tag: string | null; kind: DeviceKind }[]).map(d => [d.id, d]))
    const summary: string[] = []
    for (const s of (students ?? []) as { id: string; name: string | null; email: string | null }[]) {
      const items = (byStudent.get(s.id) ?? []).map(id => deviceById.get(id)).filter((d): d is NonNullable<typeof d> => !!d)
      if (items.length === 0) continue
      const msg = returnReminderText(s.name, items, `${appUrl()}/account#equipment`)
      await admin.from('notifications').insert({ user_id: s.id, type: RETURN_REMINDER_TYPE, message: msg.bell })
      if (s.email) {
        await notifyByEmail(s.email, msg.text).catch(() => false)
        try {
          await getResend().emails.send({ from: emailFrom(), to: s.email, subject: msg.subject, text: msg.text })
        } catch (e) {
          console.error(`hardware-reminders: email to ${s.email} failed`, e)
        }
      }
      result.studentsReminded++
      const n = countByStudent.get(s.id) ?? 1
      summary.push(`• <${appUrl()}/instructor/hardware/students/${s.id}|${s.name ?? s.email}>: ${items.map(i => i.asset_tag).join(', ')} (${n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`} reminder)`)
    }
    // Only on days a reminder actually went out.
    if (summary.length) {
      await slackPostMessage(channel(), `📬 *Return reminders sent today* (Slack, email and bell):\n${summary.join('\n')}`)
    }
  }

  // 3. Returns that just passed 60 days: one post per request, so staff can confirm lost.
  const lostLines: string[] = []
  for (const r of await loadOpenReturns(admin)) {
    if (daysSince(r.request.requested_at, now) < LIKELY_LOST_DAYS) continue
    if (!(await claimAlert(admin, `likely-lost:${r.request.id}`))) continue
    lostLines.push(`• <${appUrl()}/instructor/hardware/devices/${r.device.id}|${r.device.asset_tag}> (${KIND_LABELS[r.device.kind].toLowerCase()})${r.student ? ` from ${r.student.name ?? r.student.email}` : ''}`)
  }
  if (lostLines.length) {
    await slackPostMessage(channel(), `🕵️ *Not returned after ${LIKELY_LOST_DAYS} days.* Confirm lost, or mark received if it turned up:\n${lostLines.join('\n')}\n<${appUrl()}/instructor/hardware?tab=attention|Needs attention>`)
    result.likelyLostAlerted = lostLines.length
  }

  // 4. First day of a break: time to go through and mark graduates / drops.
  const { data: breaks } = await admin.from('calendar_breaks').select('label, start_date')
  const period = graduateReviewDue(breakPeriods((breaks ?? []) as { label: string; start_date: string }[]), today)
  if (period && await claimAlert(admin, `graduates:${period.start}`)) {
    await slackPostMessage(channel(), [
      `🎓 *${period.labels.join(' / ')} starts ${formatDateOnly(period.start)}.* Time to update hardware for students who graduated or left:`,
      '• Mark students completed on their course Users page (Tech Career Foundations and Intro to Programming), then transfer laptops from *Ready to transfer*.',
      '• For anyone who left, mark their hotspots, boosters and loaned laptops *awaiting return*.',
      `<${appUrl()}/instructor/hardware?tab=attention|Open Needs attention>`,
    ].join('\n'))
    result.graduateReview = period.start
  }

  return result
}

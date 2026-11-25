import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { slackLookupByEmail, slackPostMessage } from '@/lib/slack'
import { formatDateOnly } from '@/lib/hardware'
import { isPlanCurrent } from '@/lib/hardware-shipping'
import { HARDWARE_SLACK_CHANNEL_DEFAULT, pacificToday } from '@/lib/hardware-reminders'

// Slack messages for Comcast NOW plans (AnnieCannons pays $10/month and needs the receipt).
// Every message posts in #student-hardware and tags the staff contact (Catie): COMCAST_NOW_CONTACT_EMAIL
// when set, else whoever recorded the plan.

type Admin = ReturnType<typeof createServiceSupabaseClient>
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? 'https://lms.anniecannons.com').replace(/\/$/, '')
const hardwareChannel = () => process.env.SLACK_HARDWARE_CHANNEL || HARDWARE_SLACK_CHANNEL_DEFAULT
type PlanRow = { id: string; student_id: string; starts_on: string; ends_on: string | null; created_by: string | null }

async function contactEmail(admin: Admin, plan: Pick<PlanRow, 'created_by'>): Promise<string | null> {
  const fixed = process.env.COMCAST_NOW_CONTACT_EMAIL?.trim()
  if (fixed) return fixed
  if (!plan.created_by) return null
  const { data } = await admin.from('users').select('email').eq('id', plan.created_by).maybeSingle()
  return (data as { email: string | null } | null)?.email ?? null
}

/** "<@U123> " when the contact is on Slack, so the channel post notifies them. */
async function mention(admin: Admin, plan: Pick<PlanRow, 'created_by'>): Promise<string> {
  const email = await contactEmail(admin, plan)
  const id = email ? await slackLookupByEmail(email) : null
  return id ? `<@${id}> ` : ''
}

/** The monthly receipt reminder, posted in #student-hardware tagging the contact. Returns whether it posted. */
export async function sendReceiptReminder(admin: Admin, plan: PlanRow): Promise<boolean> {
  const { data: student } = await admin.from('users').select('name, email').eq('id', plan.student_id).maybeSingle()
  const person = student as { name: string | null; email: string | null } | null
  const name = person?.name ?? person?.email ?? 'a student'
  return slackPostMessage(hardwareChannel(),
    `${await mention(admin, plan)}💳 Comcast NOW renewed today for <${appUrl()}/instructor/hardware/students/${plan.student_id}|${name}>. Time to get this month's receipt.`)
}

/**
 * When a student with a current Comcast NOW plan is changed to observer: ask the contact (in
 * #student-hardware) to cancel the card paying for it. Never throws.
 */
export async function notifyPlanCancelOnObserver(admin: Admin, studentId: string, courseId: string): Promise<void> {
  try {
    const { data } = await admin.from('hardware_internet_plans').select('id, student_id, starts_on, ends_on, created_by').eq('student_id', studentId)
    const plans = ((data ?? []) as PlanRow[]).filter(p => isPlanCurrent(p, pacificToday()))
    if (plans.length === 0) return
    const [{ data: student }, { data: course }] = await Promise.all([
      admin.from('users').select('name, email').eq('id', studentId).maybeSingle(),
      admin.from('courses').select('name').eq('id', courseId).maybeSingle(),
    ])
    const name = (student as { name: string | null; email: string } | null)?.name ?? (student as { email: string } | null)?.email ?? 'A student'
    for (const plan of plans) {
      await slackPostMessage(hardwareChannel(),
        `${await mention(admin, plan)}💳 ${name} was changed to observer in ${(course as { name: string } | null)?.name ?? 'a course'}. ` +
        `Please cancel the credit card for their Comcast NOW plan (since ${formatDateOnly(plan.starts_on)}), then end the plan on their hardware page: ` +
        `${appUrl()}/instructor/hardware/students/${studentId}`)
    }
  } catch (e) {
    console.error('comcast: observer cancel notice failed', e)
  }
}

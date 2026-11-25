import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { openGroupDM, slackLookupByEmail, slackPostMessage } from '@/lib/slack'
import { formatDateOnly } from '@/lib/hardware'
import { isPlanCurrent } from '@/lib/hardware-shipping'
import { HARDWARE_SLACK_CHANNEL_DEFAULT, pacificToday } from '@/lib/hardware-reminders'

// Slack messages for Comcast NOW plans (AnnieCannons pays $10/month and needs the receipt).
// Receipt reminders are a group message with the staff contact (Catie) and the student; the
// cancel-the-card notice posts in #student-hardware tagging the contact: COMCAST_NOW_CONTACT_EMAIL
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

/**
 * The monthly receipt reminder: a Slack group message with the contact (Catie) and the student.
 * If either can't be found on Slack, it posts in #student-hardware tagging the contact instead.
 * Returns whether it posted.
 */
export async function sendReceiptReminder(admin: Admin, plan: PlanRow): Promise<boolean> {
  const [{ data: student }, contact] = await Promise.all([
    admin.from('users').select('name, email').eq('id', plan.student_id).maybeSingle(),
    contactEmail(admin, plan),
  ])
  const person = student as { name: string | null; email: string | null } | null
  const [contactId, studentId] = await Promise.all([
    contact ? slackLookupByEmail(contact) : null,
    person?.email ? slackLookupByEmail(person.email) : null,
  ])
  if (contactId && studentId) {
    const channel = await openGroupDM([contactId, studentId])
    const first = person?.name?.split(' ')[0] ?? 'there'
    if (channel && await slackPostMessage(channel, `Hi ${first}! Your Comcast NOW internet renewed today. Please send this month's receipt here so we can submit it. Thank you!`)) return true
  }
  const name = person?.name ?? person?.email ?? 'a student'
  return slackPostMessage(hardwareChannel(),
    `${contactId ? `<@${contactId}> ` : ''}💳 Comcast NOW renewed today for <${appUrl()}/instructor/hardware/students/${plan.student_id}|${name}>, but I couldn't message them on Slack. Please ask them for this month's receipt.`)
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

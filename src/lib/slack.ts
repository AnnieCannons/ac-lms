/**
 * Lightweight Slack helpers used by server actions and scripts.
 * Reads SLACK_BOT_TOKEN and STAFF_NOTIFY_EMAIL from process.env.
 */

const SLACK_BOT_TOKEN    = process.env.SLACK_BOT_TOKEN
const STAFF_NOTIFY_EMAIL = process.env.STAFF_NOTIFY_EMAIL

// Cache the staff Slack ID within a single process lifetime
let _staffSlackId: string | null | undefined = undefined

export async function slackLookupByEmail(email: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) return null
  try {
    const res = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    )
    const json = (await res.json()) as { ok: boolean; user?: { id: string } }
    return json.ok && json.user ? json.user.id : null
  } catch {
    return null
  }
}

export async function slackPostMessage(channel: string, text: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    })
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (!json.ok) console.warn(`Slack error: ${json.error}`)
    return json.ok
  } catch (e) {
    console.warn('Slack request failed:', e)
    return false
  }
}

/** Send a DM to the staff notify address (STAFF_NOTIFY_EMAIL env var). */
export async function notifyStaff(text: string): Promise<void> {
  if (!SLACK_BOT_TOKEN || !STAFF_NOTIFY_EMAIL) {
    console.warn('[slack] notifyStaff: missing SLACK_BOT_TOKEN or STAFF_NOTIFY_EMAIL')
    return
  }

  if (_staffSlackId === undefined) {
    _staffSlackId = await slackLookupByEmail(STAFF_NOTIFY_EMAIL)
    console.log(`[slack] looked up ${STAFF_NOTIFY_EMAIL} → ${_staffSlackId}`)
  }
  if (!_staffSlackId) {
    console.warn(`[slack] notifyStaff: could not find Slack ID for ${STAFF_NOTIFY_EMAIL}`)
    return
  }

  await slackPostMessage(_staffSlackId, text)
}

/** Send a Slack DM to an arbitrary email address. Returns true if sent. */
export async function notifyByEmail(email: string, text: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false
  const slackId = await slackLookupByEmail(email)
  if (!slackId) return false
  return slackPostMessage(slackId, text)
}

// Slack's chat.scheduleMessage rejects timestamps in the past or more than ~120 days out.
export const SLACK_SCHEDULE_MAX_DAYS = 119

export function isSchedulableTime(postAt: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  return postAt > now && postAt <= now + SLACK_SCHEDULE_MAX_DAYS * 86400
}

/** Schedule a Slack DM to an email address at a future unix timestamp. Returns true if scheduled. */
export async function scheduleSlackDM(email: string, text: string, postAt: number): Promise<boolean> {
  const scheduled = await scheduleSlackDMs(email, text, [postAt])
  return scheduled > 0
}

async function scheduleMessageForSlackId(slackId: string, text: string, postAt: number): Promise<boolean> {
  try {
    const res = await fetch('https://slack.com/api/chat.scheduleMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: slackId, text, post_at: postAt }),
    })
    const json = await res.json() as { ok: boolean; error?: string }
    if (!json.ok) console.warn(`Slack scheduleMessage error: ${json.error}`)
    return json.ok
  } catch (e) {
    console.warn('Slack scheduleMessage failed:', e)
    return false
  }
}

/**
 * Schedule Slack DMs to an email address at several future unix timestamps.
 * Looks up the Slack ID once and fires the schedule calls in parallel, instead
 * of a lookup+schedule round trip per timestamp — the addon routes call this
 * with one entry per selected reminder checkbox, and doing those serially was
 * slow enough to blow past the Gmail add-on's execution time limit.
 * Returns the number successfully scheduled.
 */
export async function scheduleSlackDMs(email: string, text: string, postAts: number[]): Promise<number> {
  if (!SLACK_BOT_TOKEN || postAts.length === 0) return 0
  const slackId = await slackLookupByEmail(email)
  if (!slackId) return 0
  const results = await Promise.all(postAts.map((postAt) => scheduleMessageForSlackId(slackId, text, postAt)))
  return results.filter(Boolean).length
}

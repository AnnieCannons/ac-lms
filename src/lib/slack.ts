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
  if (!SLACK_BOT_TOKEN || !STAFF_NOTIFY_EMAIL) return

  if (_staffSlackId === undefined) {
    _staffSlackId = await slackLookupByEmail(STAFF_NOTIFY_EMAIL)
  }
  if (!_staffSlackId) return

  await slackPostMessage(_staffSlackId, text)
}

/** Send a Slack DM to an arbitrary email address. Returns true if sent. */
export async function notifyByEmail(email: string, text: string): Promise<boolean> {
  if (!SLACK_BOT_TOKEN) return false
  const slackId = await slackLookupByEmail(email)
  if (!slackId) return false
  return slackPostMessage(slackId, text)
}

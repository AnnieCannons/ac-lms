// The Slack channels readiness posts can go to, one per track. Plain data so
// both the course settings UI and the server-side readiness code can use it.

export const READINESS_SLACK_CHANNELS: { id: string; label: string }[] = [
  { id: 'C09C56VL25D', label: 'TCF / ITP channel' },
  { id: 'C09C551E7DM', label: 'Frontend channel' },
  { id: 'C09DC5MAQ4Q', label: 'Backend channel' },
]

/** The channel id if it's one of the known readiness channels, otherwise null. */
export function validReadinessChannel(id: string | null | undefined): string | null {
  return READINESS_SLACK_CHANNELS.some(c => c.id === id) ? id! : null
}

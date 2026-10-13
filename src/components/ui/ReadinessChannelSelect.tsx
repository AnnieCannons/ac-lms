'use client'

import { READINESS_SLACK_CHANNELS } from '@/lib/readiness-channels'

/** Picks the Slack channel a course's readiness posts go to (courses.readiness_slack_channel). */
export default function ReadinessChannelSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-text mb-1">Readiness Slack Channel</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-lg p-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
      >
        <option value="">None</option>
        {READINESS_SLACK_CHANNELS.map(c => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
      <p className="text-xs text-muted-text mt-1">
        Where step 1/2 starts, completed check-ins, overdue check-ins and finished accountability processes are posted.
        With None, those posts are skipped.
      </p>
    </div>
  )
}

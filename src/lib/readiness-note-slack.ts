// Builds the Slack post for a readiness note an instructor chose to share with the
// course's readiness channel. Plain function (not a server action) so it can be tested.

import { slackEscape } from '@/lib/slack'

export function readinessNoteSlackMessage(input: {
  authorName: string | null
  studentName: string | null
  body: string
  link: string
  sharedWithStudent: boolean
  /** Slack user ids to @mention; optional. */
  mentionSlackIds: string[]
}): string {
  const author = slackEscape(input.authorName?.trim() || 'An instructor')
  const student = slackEscape(input.studentName?.trim() || 'a student')
  const shared = input.sharedWithStudent ? ' (also shared with the student)' : ''
  const quoted = slackEscape(input.body.trim())
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
  const lines = [`*${author}* added a readiness note about *${student}*${shared}: <${input.link}|View on roster>`, quoted]
  if (input.mentionSlackIds.length > 0) {
    lines.push(`cc ${input.mentionSlackIds.map(id => `<@${id}>`).join(' ')}`)
  }
  return lines.join('\n')
}

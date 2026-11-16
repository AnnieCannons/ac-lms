import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/readiness-chain', () => ({ getReadinessChain: vi.fn() }))
vi.mock('@/lib/slack', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/slack')>()),
  slackPostMessage: vi.fn(async () => true),
  slackLookupByEmail: vi.fn(async (email: string) => `U-${email}`),
  notifyByEmail: vi.fn(async () => true),
}))

import { readinessNoteSlackMessage } from '@/lib/readiness-note-slack'
import { addReadinessNote } from '@/lib/readiness-notes-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { notifyByEmail, slackPostMessage } from '@/lib/slack'

const BASE = {
  authorName: 'Catie',
  studentName: 'Amirah',
  body: 'Met today.\nPlan is to catch up by Monday.',
  link: 'https://app.example/instructor/courses/c1/roster/s1',
  sharedWithStudent: false,
  mentionSlackIds: [],
}

describe('readinessNoteSlackMessage', () => {
  it('names the author and student, links the roster and quotes every line', () => {
    const text = readinessNoteSlackMessage(BASE)
    expect(text).toContain('*Catie* added a readiness note about *Amirah*: <https://app.example/instructor/courses/c1/roster/s1|View on roster>')
    expect(text).toContain('> Met today.\n> Plan is to catch up by Monday.')
    expect(text).not.toContain('cc ')
  })

  it('tags people only when some are picked', () => {
    expect(readinessNoteSlackMessage({ ...BASE, mentionSlackIds: ['U1', 'U2'] })).toContain('cc <@U1> <@U2>')
  })

  it('says when the note is also shared with the student', () => {
    expect(readinessNoteSlackMessage({ ...BASE, sharedWithStudent: true })).toContain('(also shared with the student)')
  })

  it('escapes the note so it cannot ping a channel', () => {
    expect(readinessNoteSlackMessage({ ...BASE, body: '<!channel> help' })).not.toContain('<!channel>')
  })
})

// Thenable chain where every method returns the chain, so `await` works at any point.
function chain(result: unknown) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return () => c
    },
  })
  return c as never
}

function setup(channel: string | null) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'staff1' } } }) },
    from: () => chain({ data: { role: 'instructor' } }),
  } as never)
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'courses') return chain({ data: { readiness_slack_channel: channel } })
      if (table === 'course_enrollments') return chain({ data: [] })
      if (table === 'users') {
        return chain({ data: [
          { id: 'staff1', name: 'Catie', email: 'c@x.org', slack_email: null },
          { id: 's1', name: 'Amirah', email: 'a@x.org', slack_email: null },
          { id: 'robyn', name: 'Robyn', email: 'r@x.org', slack_email: 'rs@x.org' },
        ] })
      }
      if (table === 'notifications') return { insert: () => Promise.resolve({ error: null }) }
      return { insert: () => chain({ data: { id: 'note1' }, error: null }) }
    },
  } as never)
}

const ADD = { studentId: 's1', courseId: 'c1', noteDate: '2026-11-16', body: 'Met today.', visibleToStudent: false }

beforeEach(() => vi.clearAllMocks())

describe('addReadinessNote → Slack', () => {
  it('does not post unless asked', async () => {
    setup('C09C56VL25D')
    expect(await addReadinessNote(ADD)).toEqual({})
    expect(slackPostMessage).not.toHaveBeenCalled()
  })

  it('posts to the course readiness channel, tagging picked people by their Slack email', async () => {
    setup('C09C56VL25D')
    expect(await addReadinessNote({ ...ADD, postToSlack: true, mentionUserIds: ['robyn'] })).toEqual({})
    expect(slackPostMessage).toHaveBeenCalledWith('C09C56VL25D', expect.stringContaining('cc <@U-rs@x.org>'))
  })

  it('posts without tags when nobody is picked', async () => {
    setup('C09C56VL25D')
    await addReadinessNote({ ...ADD, postToSlack: true })
    expect(vi.mocked(slackPostMessage).mock.calls[0][1]).not.toContain('cc ')
  })

  it('saves the note but warns when the course has no readiness channel', async () => {
    setup(null)
    expect(await addReadinessNote({ ...ADD, postToSlack: true })).toEqual({
      slackError: 'The note was saved, but it couldn’t be posted to Slack.',
    })
    expect(slackPostMessage).not.toHaveBeenCalled()
  })
})

describe('readiness note Slack messages to and from students', () => {
  function setupReply(viewerId: string, viewerRole: string) {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: viewerId } } }) },
      from: () => chain({ data: { role: viewerRole } }),
    } as never)
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'readiness_notes') {
          return chain({ data: { id: 'note1', student_id: 's1', course_id: 'c1', author_id: 'staff1', visible_to_student: true } })
        }
        if (table === 'readiness_note_replies') return { insert: () => chain({ data: { id: 'r1' }, error: null }) }
        if (table === 'courses') return chain({ data: { readiness_slack_channel: 'C09C56VL25D' } })
        if (table === 'users') {
          const name = viewerId === 's1' ? 'Amirah' : 'Catie'
          return chain({ data: { name, email: 'a@x.org', slack_email: 'amirah@slack.org' } })
        }
        return { insert: () => Promise.resolve({ error: null }) }
      },
    } as never)
  }

  it("posts a student's reply to the course readiness channel", async () => {
    setupReply('s1', 'student')
    const { addReadinessNoteReply } = await import('@/lib/readiness-notes-actions')
    expect(await addReadinessNoteReply({ noteId: 'note1', body: 'Thanks, will do!' })).toEqual({})
    expect(slackPostMessage).toHaveBeenCalledTimes(1)
    const [channel, text] = vi.mocked(slackPostMessage).mock.calls[0]
    expect(channel).toBe('C09C56VL25D')
    expect(text).toContain('*Amirah* replied to a readiness note')
    expect(text).toContain('> Thanks, will do!')
    expect(notifyByEmail).not.toHaveBeenCalled()
  })

  it('DMs the student on Slack when staff reply', async () => {
    setupReply('staff1', 'instructor')
    const { addReadinessNoteReply } = await import('@/lib/readiness-notes-actions')
    await addReadinessNoteReply({ noteId: 'note1', body: 'Great work.' })
    // DM goes to the student's Slack email, and nothing is posted to the channel.
    expect(notifyByEmail).toHaveBeenCalledWith('amirah@slack.org', expect.stringContaining('Catie replied to a note on your Weekly Readiness page'))
    expect(slackPostMessage).not.toHaveBeenCalled()
  })

  it('DMs the student on Slack when a note is shared with them', async () => {
    setupReply('staff1', 'instructor')
    expect(await addReadinessNote({ ...ADD, visibleToStudent: true })).toEqual({})
    expect(notifyByEmail).toHaveBeenCalledWith('amirah@slack.org', expect.stringContaining('Catie shared a note with you'))
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('next/server', () => ({ after: vi.fn() }))
import { after } from 'next/server'
vi.mock('@/lib/slack', () => ({ notifyByEmail: vi.fn() }))

import {
  deleteCuttingEdgeEvent,
  saveCuttingEdgeEvent,
  setCuttingEdgeEventPublished,
  setMyCuttingEdgeRsvp,
  setMyCuttingEdgeThanks,
} from '@/lib/cutting-edge-actions'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

// Thenable chain: every method returns the chain; awaiting it resolves to `result`.
function chain(result: unknown, log?: [string, unknown[]][]) {
  const c: unknown = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return (...args: unknown[]) => { log?.push([String(prop), args]); return c }
    },
  })
  return c as never
}

function signedInAs(role: string) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    from: () => chain({ data: { role } }),
  } as never)
}

const input = {
  title: 'Talk', speaker: 'Speaker', date: '2026-10-23', time: '12:00', startsAt: '2026-10-23T19:00:00.000Z', block: '' as const, locationText: 'Zoom', locationUrl: '', aboutHtml: '',
  audienceAll: true, courseIds: [], questionDueDate: '2026-10-16', questionHtml: '', questionPadletUrl: '',
  thanksDueDate: '2026-10-30', thanksHtml: '', thanksPadletUrl: '',
}

beforeEach(() => vi.clearAllMocks())

describe('staff-only actions', () => {
  it.each(['student', 'ta'])('rejects a %s for create, publish and delete', async role => {
    signedInAs(role)
    const service = vi.mocked(createServiceSupabaseClient)
    expect(await saveCuttingEdgeEvent(null, input)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await setCuttingEdgeEventPublished('e1', true)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await deleteCuttingEdgeEvent('e1')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(service).not.toHaveBeenCalled()
  })
})

describe('publishing', () => {
  function adminWithEvent(firstPublishedAt: string | null) {
    signedInAs('admin')
    const log: [string, unknown[]][] = []
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: () => chain({ data: { id: 'e1', first_published_at: firstPublishedAt, deleted_at: null }, error: null }, log),
    } as never)
    return log
  }

  it('sends the RSVP prompt on first publish', async () => {
    adminWithEvent(null)
    expect(await setCuttingEdgeEventPublished('e1', true)).toEqual({ ok: true })
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('publishes quietly when notify is off, still recording the first publish', async () => {
    const log = adminWithEvent(null)
    expect(await setCuttingEdgeEventPublished('e1', true, false)).toEqual({ ok: true })
    expect(after).not.toHaveBeenCalled()
    const update = log.find(([m]) => m === 'update')?.[1][0] as Record<string, unknown>
    expect(update.status).toBe('published')
    expect(update.first_published_at).toBeTruthy()
  })

  it('never re-sends on a later publish', async () => {
    adminWithEvent('2026-10-01T00:00:00Z')
    await setCuttingEdgeEventPublished('e1', true)
    expect(after).not.toHaveBeenCalled()
  })
})

describe('student actions', () => {
  function studentWith({ enrolled = true, startsAt }: { enrolled?: boolean; startsAt: string }) {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    } as never)
    const log: [string, unknown[]][] = []
    const event = { id: 'e1', status: 'published', deleted_at: null, audience_all: false, starts_at: startsAt }
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'course_enrollments') return chain({ data: enrolled ? { role: 'student' } : null })
        if (table === 'cutting_edge_events') return chain({ data: event })
        if (table === 'cutting_edge_event_courses') return chain({ data: [{ course_id: 'c1' }] })
        return chain({ error: null }, log)
      },
    } as never)
    return log
  }

  it('rejects someone who is not enrolled as a student (e.g. an instructor previewing)', async () => {
    studentWith({ enrolled: false, startsAt: '2099-01-01T00:00:00Z' })
    expect(await setMyCuttingEdgeRsvp('c1', 'e1', 'yes')).toMatchObject({ ok: false })
  })

  it('records an RSVP before the event and refuses one after it starts', async () => {
    const log = studentWith({ startsAt: '2099-01-01T00:00:00Z' })
    expect(await setMyCuttingEdgeRsvp('c1', 'e1', 'yes')).toEqual({ ok: true })
    expect(log.find(([m]) => m === 'upsert')?.[1][0]).toMatchObject({ user_id: 'me', response: 'yes' })

    studentWith({ startsAt: '2000-01-01T00:00:00Z' })
    expect(await setMyCuttingEdgeRsvp('c1', 'e1', 'no')).toMatchObject({ ok: false, error: expect.stringMatching(/closed/) })
  })

  it('rejects a course outside a limited audience', async () => {
    studentWith({ startsAt: '2099-01-01T00:00:00Z' })
    expect(await setMyCuttingEdgeRsvp('other-course', 'e1', 'yes')).toEqual({ ok: false, error: 'Event not found.' })
  })

  it('keeps "done" and "did not make it" mutually exclusive, and only after the talk', async () => {
    const log = studentWith({ startsAt: '2000-01-01T00:00:00Z' })
    expect(await setMyCuttingEdgeThanks('c1', 'e1', 'missed')).toEqual({ ok: true })
    const row = log.find(([m]) => m === 'upsert')?.[1][0] as Record<string, unknown>
    expect(row.thanks_done_at).toBeNull()
    expect(row.missed_at).toBeTruthy()

    studentWith({ startsAt: '2099-01-01T00:00:00Z' })
    expect(await setMyCuttingEdgeThanks('c1', 'e1', 'done')).toMatchObject({ ok: false })
  })
})

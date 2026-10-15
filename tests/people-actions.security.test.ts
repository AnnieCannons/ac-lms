import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/airtable', () => ({ resolveAirtableStudentIdByEmail: vi.fn() }))

import { addPersonToCourse, bulkAddPeopleToCourse, removeStudentUser } from '@/lib/people-actions'
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

beforeEach(() => vi.clearAllMocks())

describe('granting the admin role', () => {
  it.each(['instructor', 'staff'])('a %s cannot add someone to a course as admin', async role => {
    signedInAs(role)
    expect(await addPersonToCourse('c1', 'me@example.com', 'admin')).toEqual({ error: 'Only admins can assign the admin role.' })
    expect(await bulkAddPeopleToCourse('c1', ['me@example.com'], 'admin')).toEqual([
      { email: 'me@example.com', error: 'Only admins can assign the admin role.' },
    ])
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('rejects an unknown role string', async () => {
    signedInAs('admin')
    expect(await addPersonToCourse('c1', 'x@example.com', 'superuser' as never)).toEqual({ error: 'Invalid role' })
  })
})

describe('removeStudentUser', () => {
  function serviceWithTarget(targetRole: string) {
    const log: [string, unknown[]][] = []
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: () => chain({ data: { role: targetRole }, error: null }, log),
      auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } },
    } as never)
    return log
  }

  it.each(['admin', 'instructor', 'staff'])('an instructor cannot delete a %s account', async targetRole => {
    signedInAs('instructor')
    const log = serviceWithTarget(targetRole)
    expect(await removeStudentUser('victim')).toEqual({ error: 'Only admins can delete staff accounts.' })
    expect(log.some(([m]) => m === 'delete')).toBe(false)
  })

  it('an instructor can still delete a student', async () => {
    signedInAs('instructor')
    const log = serviceWithTarget('student')
    expect(await removeStudentUser('s1')).toEqual({})
    expect(log.some(([m]) => m === 'delete')).toBe(true)
  })
})

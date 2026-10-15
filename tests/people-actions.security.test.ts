import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/airtable', () => ({ resolveAirtableStudentIdByEmail: vi.fn() }))

import { addPersonToCourse, bulkAddPeopleToCourse, removeStudentUser, updateUserRole } from '@/lib/people-actions'
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

describe('demoting an admin', () => {
  // Service client whose users lookups return `rows[id]` and logs every call.
  function serviceWithUsers(rows: Record<string, string>) {
    const log: [string, unknown[]][] = []
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        const calls: [string, unknown[]][] = []
        const c: unknown = new Proxy({}, {
          get(_, prop) {
            if (prop === 'then') {
              const id = calls.find(([m, a]) => m === 'eq' && a[0] === 'id')?.[1][1] as string | undefined
              const result = table === 'users' && id && rows[id]
                ? { data: calls.some(([m]) => m === 'update') ? [{ id }] : { id, role: rows[id] }, error: null }
                : { data: null, error: null }
              return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
            }
            return (...args: unknown[]) => { calls.push([String(prop), args]); log.push([`${table}.${String(prop)}`, args]); return c }
          },
        })
        return c
      },
    } as never)
    return log
  }

  it.each(['instructor', 'staff'])("a %s cannot change an admin's role", async role => {
    serviceWithUsers({ me: role, boss: 'admin' })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) } } as never)
    expect(await updateUserRole('boss', 'instructor')).toEqual({ error: "Only admins can change an admin's role." })
  })

  it("an admin can change another admin's role", async () => {
    const log = serviceWithUsers({ me: 'admin', boss: 'admin' })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) } } as never)
    expect(await updateUserRole('boss', 'instructor')).toEqual({})
    expect(log).toContainEqual(['users.update', [{ role: 'instructor' }]])
  })

  it('an instructor can still change a non-admin role', async () => {
    serviceWithUsers({ me: 'instructor', s1: 'student' })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) } } as never)
    expect(await updateUserRole('s1', 'staff')).toEqual({})
  })

  it('adding an existing admin to a course as instructor keeps them admin', async () => {
    signedInAs('instructor')
    const log: [string, unknown[]][] = []
    let usersCall = 0
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'users') {
          usersCall++
          // 1st: lookup by email → existing user; 2nd: current role → admin
          return chain(usersCall === 1 ? { data: { id: 'boss' } } : { data: { role: 'admin' } }, log)
        }
        // enrollment lookup → none; insert → ok
        return chain({ data: null, error: null }, log)
      },
    } as never)
    expect(await addPersonToCourse('c1', 'boss@example.com', 'instructor')).toEqual({ added: true })
    expect(log.some(([m]) => m === 'update')).toBe(false)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import {
  addHardwareNote,
  addToHardwareWaitlist,
  recordHardwareReplacement,
  removeFromHardwareWaitlist,
  transferHardwareOwnership,
  cancelHardwareReturn,
  confirmHardwareLost,
  loanHardwareDevice,
  markHardwareAwaitingReturn,
  markHardwarePrepped,
  receiveHardwareDevices,
  searchHardwareStudents,
  createHardwareDevice,
  createHardwarePurchaseBatch,
  setHardwareDeviceStatus,
  updateHardwareDevice,
} from '@/lib/hardware-actions'
import { emptyDeviceInput, type BatchInput } from '@/lib/hardware'
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

/** Service client whose `from(table)` resolves to the result given for that table. */
function serviceWith(results: Record<string, unknown>, log: [string, unknown[]][] = []) {
  vi.mocked(createServiceSupabaseClient).mockReturnValue({
    from: (table: string) => { log.push(['from', [table]]); return chain(results[table] ?? { data: null, error: null }, log) },
  } as never)
  return log
}

const batch: BatchInput = {
  kind: 'laptop', purchasedOn: '2026-10-01', vendor: 'Back Market', makeModel: 'Dell Latitude 5420', modelYear: '2021',
  condition: 'refurbished', unitCost: '289.99', warrantyEndsOn: '', notes: '', identifiers: 'SN1\nSN2', count: '',
}

beforeEach(() => vi.clearAllMocks())

describe('staff-only actions', () => {
  it.each(['student', 'ta', ''])('rejects role %j and never touches the service client', async role => {
    signedInAs(role)
    const laptop = { ...emptyDeviceInput('laptop'), serialNumber: 'SN1' }
    expect(await createHardwareDevice(laptop)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await createHardwarePurchaseBatch(batch)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await updateHardwareDevice('d1', laptop)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await setHardwareDeviceStatus('d1', 'retired', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await addHardwareNote('d1', 'hi')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })
})

describe('createHardwarePurchaseBatch', () => {
  it('refuses the whole batch when a serial is already in the tracker, ignoring case', async () => {
    signedInAs('staff')
    const log = serviceWith({ hardware_devices: { data: [{ serial_number: 'sn2 ' }], error: null } })
    expect(await createHardwarePurchaseBatch(batch)).toEqual({ ok: false, error: 'Already in the tracker: SN2' })
    expect(log.some(([m, a]) => m === 'from' && a[0] === 'hardware_purchase_batches')).toBe(false)
  })

  it('creates one device per serial with the shared details', async () => {
    signedInAs('instructor')
    const inserts: [string, unknown][] = []
    const devices = { data: [{ id: 'd1' }, { id: 'd2' }], error: null }
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => {
        const result = table === 'hardware_purchase_batches' ? { data: { id: 'b1' }, error: null }
          : table === 'hardware_devices' ? { data: [], error: null } : { data: null, error: null }
        const log: [string, unknown[]][] = []
        const c = chain(result, log)
        return new Proxy({}, {
          get(_, prop) {
            if (prop === 'insert') return (rows: unknown) => {
              inserts.push([table, rows])
              return table === 'hardware_devices' ? chain(devices) : c
            }
            return (c as Record<string, unknown>)[prop as string]
          },
        })
      },
    } as never)

    expect(await createHardwarePurchaseBatch(batch)).toEqual({ ok: true, batchId: 'b1', created: 2 })
    const deviceRows = inserts.find(([t]) => t === 'hardware_devices')![1] as Record<string, unknown>[]
    expect(deviceRows).toHaveLength(2)
    expect(deviceRows[0]).toMatchObject({ kind: 'laptop', serial_number: 'SN1', model_year: 2021, condition: 'refurbished', purchase_batch_id: 'b1' })
    expect(deviceRows[1]).toMatchObject({ serial_number: 'SN2' })
  })
})

describe('setHardwareDeviceStatus', () => {
  it('refuses loan statuses, which come from a loan', async () => {
    signedInAs('admin')
    expect(await setHardwareDeviceStatus('d1', 'on_loan', '')).toEqual({ ok: false, error: 'That status is set from a loan, not by hand.' })
  })

  it('refuses a device that is with a student', async () => {
    signedInAs('admin')
    serviceWith({ hardware_devices: { data: { status: 'on_loan', current_holder_id: 's1' }, error: null } })
    expect(await setHardwareDeviceStatus('d1', 'retired', '')).toMatchObject({ ok: false })
  })
})

describe('loans and returns', () => {
  it.each(['student', 'ta'])('rejects a %s for every loan action', async role => {
    signedInAs(role)
    expect(await loanHardwareDevice('d1', 's1', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await markHardwareAwaitingReturn(['d1'], '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await cancelHardwareReturn('d1', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await receiveHardwareDevices(['d1'], 'needs_prep', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await markHardwarePrepped('d1')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await confirmHardwareLost('d1', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await searchHardwareStudents('ana')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('only loans to a student', async () => {
    signedInAs('staff')
    serviceWith({ users: { data: { id: 'x', role: 'instructor' }, error: null } })
    expect(await loanHardwareDevice('d1', 'x', '')).toEqual({ ok: false, error: 'Choose a student.' })
  })

  it('refuses to loan a device that is not in stock', async () => {
    signedInAs('staff')
    const log = serviceWith({
      users: { data: { id: 's1', role: 'student' }, error: null },
      hardware_devices: { data: [], error: null },
    })
    expect(await loanHardwareDevice('d1', 's1', '')).toEqual({ ok: false, error: 'Only a device that is in stock can be loaned.' })
    expect(log.some(([m, a]) => m === 'eq' && a[0] === 'status' && a[1] === 'in_stock')).toBe(true)
    expect(log.some(([m, a]) => m === 'from' && a[0] === 'hardware_events')).toBe(false)
  })

  it('opens a return request with the first reminder 48 hours out', async () => {
    signedInAs('instructor')
    const log = serviceWith({ hardware_devices: { data: [{ id: 'd1', current_holder_id: 's1' }], error: null } })
    expect(await markHardwareAwaitingReturn(['d1', 'd1'], 'dropped')).toEqual({ ok: true, marked: 1 })
    const insert = log.find(([m], i) => m === 'insert' && log[i - 1]?.[0] === 'from' && log[i - 1][1][0] === 'hardware_return_requests')!
    const row = (insert[1][0] as Record<string, string>[])[0]
    expect(row).toMatchObject({ device_id: 'd1', student_id: 's1', requested_by: 'me' })
    expect(new Date(row.next_reminder_at).getTime() - new Date(row.requested_at).getTime()).toBe(48 * 60 * 60 * 1000)
  })

  it('receives a device: clears the holder, closes the request and records the student', async () => {
    signedInAs('admin')
    const log = serviceWith({ hardware_devices: { data: [{ id: 'd1', current_holder_id: 's1' }], error: null } })
    expect(await receiveHardwareDevices(['d1'], 'needs_prep', 'scratched lid')).toEqual({ ok: true, received: 1 })
    expect(log.some(([m, a]) => m === 'update' && (a[0] as Record<string, unknown>).current_holder_id === null && (a[0] as Record<string, unknown>).status === 'needs_prep')).toBe(true)
    expect(log.some(([m, a]) => m === 'update' && (a[0] as Record<string, unknown>).closed_reason === 'received')).toBe(true)
    const event = log.find(([m, a]) => m === 'insert' && Array.isArray(a[0]) && (a[0] as Record<string, unknown>[])[0]?.type === 'received')!
    expect((event[1][0] as Record<string, unknown>[])[0]).toMatchObject({ device_id: 'd1', student_id: 's1', notes: 'Next: Needs prep\nscratched lid' })
  })

  it('refuses an invalid next status after receiving', async () => {
    signedInAs('admin')
    expect(await receiveHardwareDevices(['d1'], 'lost' as never, '')).toEqual({ ok: false, error: 'Choose what happens next.' })
  })

  it('only marks lost a device that is awaiting return', async () => {
    signedInAs('admin')
    serviceWith({ hardware_devices: { data: [], error: null } })
    expect(await confirmHardwareLost('d1', '')).toMatchObject({ ok: false })
  })
})

describe('ownership, replacements and waitlist', () => {
  const replacement = {
    studentId: 's1', kind: 'laptop' as const, oldDeviceId: 'old', newDeviceId: 'new', oldComingBack: true,
    writeOff: '' as const, writeOffReason: '', overrideNote: '', notes: '',
  }

  it.each(['student', 'ta'])('rejects a %s', async role => {
    signedInAs(role)
    expect(await transferHardwareOwnership('d1', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await recordHardwareReplacement(replacement)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await addToHardwareWaitlist('s1', 'hotspot', '')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await removeFromHardwareWaitlist('w1')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('only transfers a laptop that is on loan', async () => {
    signedInAs('staff')
    const log = serviceWith({ hardware_devices: { data: [], error: null } })
    expect(await transferHardwareOwnership('d1', '')).toEqual({ ok: false, error: 'Only a laptop that is on loan can be transferred.' })
    expect(log.some(([m, a]) => m === 'eq' && a[0] === 'kind' && a[1] === 'laptop')).toBe(true)
    expect(log.some(([m, a]) => m === 'eq' && a[0] === 'status' && a[1] === 'on_loan')).toBe(true)
  })

  it('needs an override note for a second laptop replacement', async () => {
    signedInAs('instructor')
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => chain(
        table === 'users' ? { data: { id: 's1', role: 'student' }, error: null }
          : table === 'hardware_replacements' ? { count: 1, data: null, error: null }
          : { data: null, error: null },
      ),
    } as never)
    expect(await recordHardwareReplacement(replacement)).toMatchObject({ ok: false, error: expect.stringMatching(/already used their laptop replacement/) })
  })

  it('refuses to replace a laptop that is not with the student', async () => {
    signedInAs('instructor')
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => chain(
        table === 'users' ? { data: { id: 's1', role: 'student' }, error: null }
          : table === 'hardware_replacements' ? { count: 0, data: null, error: null }
          : { data: { id: 'old', status: 'on_loan', kind: 'laptop', current_holder_id: 'someone-else' }, error: null },
      ),
    } as never)
    expect(await recordHardwareReplacement(replacement)).toEqual({ ok: false, error: 'That laptop is not with this student.' })
  })

  it('says so when a student is already on the waitlist', async () => {
    signedInAs('staff')
    vi.mocked(createServiceSupabaseClient).mockReturnValue({
      from: (table: string) => chain(table === 'users' ? { data: { id: 's1', role: 'student' }, error: null } : { data: null, error: { code: '23505', message: 'dup' } }),
    } as never)
    expect(await addToHardwareWaitlist('s1', 'hotspot', '')).toEqual({ ok: false, error: 'This student is already waiting for one.' })
  })
})

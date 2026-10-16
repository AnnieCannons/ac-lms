import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import {
  addHardwareNote,
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

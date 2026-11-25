import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/hardware-access', () => ({ getHardwareActor: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { void fn() } }))
const dms: string[] = []
vi.mock('@/lib/slack', () => ({ notifyByEmail: vi.fn(async (_e: string, t: string) => { dms.push(t); return true }), slackEscape: (t: string) => t, slackPostMessage: vi.fn(async () => true) }))
const emails: unknown[] = []
vi.mock('@/lib/resend', () => ({ getResend: () => ({ emails: { send: vi.fn(async (m: unknown) => { emails.push(m) }) } }) }))

import { confirmMyShipment, endInternetPlan, markShipmentArrived, saveInternetPlan, setStudentNeeds, shipToStudent, updateShipment } from '@/lib/hardware-shipping-actions'
import { getHardwareActor } from '@/lib/hardware-access'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import type { ShipInput } from '@/lib/hardware-shipping'

type Op = [string, unknown[]]
type Resolver = (table: string, ops: Op[]) => unknown

/** A fake service client: each query's result comes from `resolve(table, ops)`; writes are logged. */
function db(resolve: Resolver) {
  const writes: { table: string; op: string; row: unknown; ops: Op[] }[] = []
  const admin = {
    from: (table: string) => {
      const ops: Op[] = []
      const chainObj: unknown = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve(resolve(table, ops)).then(res)
          return (...args: unknown[]) => {
            ops.push([String(prop), args])
            if (['insert', 'upsert', 'update'].includes(String(prop))) writes.push({ table, op: String(prop), row: args[0], ops })
            return chainObj
          }
        },
      })
      return chainObj
    },
  }
  vi.mocked(createServiceSupabaseClient).mockReturnValue(admin as never)
  return writes
}

const as = (role: 'staff' | 'ta' | null) => vi.mocked(getHardwareActor).mockResolvedValue(
  role === null ? null : { userId: 'me', name: 'Me', role: role === 'ta' ? 'student' : 'staff', canManage: role === 'staff' },
)
const has = (ops: Op[], name: string) => ops.some(([op]) => op === name)

const student = { id: 'st', name: 'Jordan Rivera', email: 'jordan@example.com', role: 'student' }
const laptop = { id: 'lap', kind: 'laptop', asset_tag: 'LAP-012', status: 'in_stock', current_holder_id: null }
const ship: ShipInput = { studentId: 'st', loanDeviceIds: ['lap'], heldDeviceIds: [], carrier: 'usps', trackingNumber: '9400 1234', shippedOn: '2026-12-12', notes: '' }

beforeEach(() => {
  vi.clearAllMocks()
  dms.length = 0
  emails.length = 0
})

describe('who can do what', () => {
  it('only staff set choices or Comcast NOW plans; TAs and students can’t', async () => {
    for (const role of ['ta', null] as const) {
      as(role)
      expect(await setStudentNeeds('st', { wifi: 'hotspot' })).toEqual({ ok: false, error: 'Not authorized.' })
      expect(await saveInternetPlan('st', null, { accountNumber: '', monthlyCost: '', startsOn: '2026-12-03', endsOn: '', notes: '' })).toEqual({ ok: false, error: 'Not authorized.' })
      expect(await endInternetPlan('p1')).toEqual({ ok: false, error: 'Not authorized.' })
      expect(await updateShipment('b1', { carrier: 'usps', trackingNumber: '1', shippedOn: '2026-12-12', notes: '' })).toEqual({ ok: false, error: 'Not authorized.' })
    }
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })

  it('students can’t ship or mark arrived', async () => {
    as(null)
    expect(await shipToStudent(ship)).toEqual({ ok: false, error: 'Not authorized.' })
    expect(await markShipmentArrived('b1')).toEqual({ ok: false, error: 'Not authorized.' })
    expect(createServiceSupabaseClient).not.toHaveBeenCalled()
  })
})

describe('shipToStudent', () => {
  const normal: Resolver = (table, ops) => {
    if (table === 'users') return { data: student }
    if (table === 'hardware_devices') return has(ops, 'update') ? { data: [{ id: 'lap', kind: 'laptop' }], error: null } : { data: [laptop] }
    if (table === 'hardware_shipments') return { data: { id: 'b1' }, error: null }
    return { data: null, error: null }
  }

  it('loans the device, records the box and tells the student (TAs can too)', async () => {
    as('ta')
    const writes = db(normal)
    expect(await shipToStudent(ship)).toEqual({ ok: true, shipmentId: 'b1' })
    expect(writes.find(w => w.table === 'hardware_devices')?.row).toMatchObject({ status: 'on_loan', current_holder_id: 'st' })
    expect(writes.find(w => w.table === 'hardware_shipments')?.row).toMatchObject({ student_id: 'st', device_ids: ['lap'], carrier: 'usps', tracking_number: '94001234', shipped_on: '2026-12-12' })
    expect(writes.filter(w => w.table === 'hardware_events').map(w => w.row)).toEqual([
      [expect.objectContaining({ device_id: 'lap', type: 'loaned' })],
      [expect.objectContaining({ device_id: 'lap', type: 'shipped', notes: 'USPS 94001234' })],
    ])
    expect(writes.find(w => w.table === 'hardware_waitlist')?.row).toMatchObject({ fulfilled_device_id: 'lap' })
    expect(writes.find(w => w.table === 'notifications')?.row).toMatchObject({ user_id: 'st', type: 'hardware_shipped' })
    // Slack DM and email go out after the response
    await vi.waitFor(() => expect(emails).toHaveLength(1))
    expect(dms[0]).toContain('94001234')
  })

  it('refuses a device that’s no longer in stock, before changing anything', async () => {
    as('staff')
    const writes = db((table, ops) => table === 'hardware_devices' && !has(ops, 'update')
      ? { data: [{ ...laptop, status: 'on_loan', current_holder_id: 'someone' }] }
      : normal(table, ops))
    expect(await shipToStudent(ship)).toEqual({ ok: false, error: "LAP-012 isn't in stock any more." })
    expect(writes).toEqual([])
  })

  it('if a device is taken between checking and loaning, puts the others back and ships nothing', async () => {
    as('staff')
    const hotspot = { id: 'hot', kind: 'hotspot', asset_tag: 'HOT-003', status: 'in_stock', current_holder_id: null }
    const writes = db((table, ops) => {
      if (table === 'hardware_devices' && has(ops, 'update')) {
        // the loan only got the laptop; the hotspot went to someone else a moment ago
        return has(ops, 'select') ? { data: [{ id: 'lap' }], error: null } : { data: null, error: null }
      }
      if (table === 'hardware_devices') return { data: [laptop, hotspot] }
      return normal(table, ops)
    })
    expect(await shipToStudent({ ...ship, loanDeviceIds: ['lap', 'hot'] })).toEqual({ ok: false, error: 'HOT-003 was just taken by someone else. Nothing was shipped.' })
    const deviceWrites = writes.filter(w => w.table === 'hardware_devices').map(w => w.row)
    expect(deviceWrites[1]).toMatchObject({ status: 'in_stock', current_holder_id: null })
    expect(writes.some(w => ['hardware_shipments', 'hardware_events', 'hardware_waitlist', 'notifications'].includes(w.table))).toBe(false)
  })

  it('only includes already-loaned devices that are with this student', async () => {
    as('staff')
    const writes = db((table, ops) => table === 'hardware_devices' && !has(ops, 'update')
      ? { data: [{ ...laptop, status: 'on_loan', current_holder_id: 'someone-else' }] }
      : normal(table, ops))
    expect(await shipToStudent({ ...ship, loanDeviceIds: [], heldDeviceIds: ['lap'] })).toMatchObject({ ok: false })
    expect(writes).toEqual([])
  })

  it('needs a tracking number', async () => {
    as('staff')
    db(normal)
    expect(await shipToStudent({ ...ship, trackingNumber: ' ' })).toEqual({ ok: false, error: 'Add the tracking number.' })
  })
})

describe('arrivals', () => {
  const shipment = { id: 'b1', student_id: 'st', device_ids: ['lap'], received_at: null }
  const signedInAs = (id: string) => vi.mocked(createServerSupabaseClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } } }) } } as never)

  it('lets a student confirm their own box', async () => {
    signedInAs('st')
    const writes = db(table => (table === 'hardware_shipments' ? { data: [shipment], error: null } : { error: null }))
    expect(await confirmMyShipment('b1')).toEqual({ ok: true })
    expect(writes.find(w => w.table === 'hardware_shipments')?.row).toMatchObject({ received_by: 'st' })
    expect(writes.find(w => w.table === 'hardware_events')?.row).toEqual([expect.objectContaining({ type: 'arrived', actor_id: 'st' })])
  })

  it('refuses anyone else’s box', async () => {
    signedInAs('someone-else')
    const writes = db(table => (table === 'hardware_shipments' ? { data: [shipment], error: null } : { error: null }))
    expect(await confirmMyShipment('b1')).toEqual({ ok: false, error: 'Shipment not found.' })
    expect(writes).toEqual([])
  })
})

describe('setStudentNeeds', () => {
  const resolver = (finished: boolean): Resolver => (table, ops) => {
    if (table === 'users') return { data: student }
    if (table === 'hardware_student_needs') return { data: [{ student_id: 'st', laptop: 'needs', wifi: 'booster' }] }
    if (table === 'hardware_alerts_sent') return { data: finished ? [{ key: 'onboarding-finished:er:st' }] : [] }
    if (table === 'hardware_devices') return { data: [] }
    void ops
    return { data: null, error: null }
  }

  it('saves the choice, drops waitlist entries it rules out and logs it', async () => {
    as('staff')
    const writes = db(resolver(false))
    expect(await setStudentNeeds('st', { wifi: 'hotspot' })).toEqual({ ok: true })
    expect(writes.find(w => w.table === 'hardware_student_needs')?.row).toMatchObject({ student_id: 'st', laptop: 'needs', wifi: 'hotspot' })
    expect(writes.find(w => w.table === 'hardware_events')?.row).toMatchObject({ type: 'needs_updated', notes: 'Wifi: Hotspot' })
    const dropped = writes.find(w => w.table === 'hardware_waitlist' && w.op === 'update')
    expect(dropped?.ops).toContainEqual(['in', ['kind', ['booster']]])
    // not finished yet, so nothing joins the waitlist
    expect(writes.filter(w => w.table === 'hardware_waitlist' && w.op === 'insert')).toEqual([])
  })

  it('once they’ve finished Enrollment Readiness, puts what they now need on the waitlist', async () => {
    as('staff')
    const writes = db(resolver(true))
    expect(await setStudentNeeds('st', { wifi: 'hotspot' })).toEqual({ ok: true })
    expect(writes.filter(w => w.table === 'hardware_waitlist' && w.op === 'insert').map(w => (w.row as { kind: string }).kind)).toEqual(['laptop', 'hotspot'])
  })

  it('changing Laptop never drops a hotspot or booster someone was waitlisted for by hand', async () => {
    as('staff')
    const writes = db((table, ops) => {
      if (table === 'hardware_student_needs') return { data: [] } // no row: needs a laptop, wifi None
      return resolver(false)(table, ops)
    })
    expect(await setStudentNeeds('st', { laptop: 'own' })).toEqual({ ok: true })
    const dropped = writes.find(w => w.table === 'hardware_waitlist' && w.op === 'update')
    expect(dropped?.ops).toContainEqual(['in', ['kind', ['laptop']]])
  })

  it('does nothing when the choice is unchanged', async () => {
    as('staff')
    const writes = db(resolver(true))
    expect(await setStudentNeeds('st', { wifi: 'booster' })).toEqual({ ok: true })
    expect(writes).toEqual([])
  })

  it('rejects made-up choices', async () => {
    as('staff')
    expect(await setStudentNeeds('st', { wifi: 'satellite' as never })).toEqual({ ok: false, error: 'Choose a wifi option.' })
  })
})

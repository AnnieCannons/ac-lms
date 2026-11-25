import { describe, it, expect } from 'vitest'
import {
  DEFAULT_NEEDS,
  deviceKindsNeeded,
  inTransit,
  kindList,
  latestShipmentFor,
  monthlyDate,
  nextRenewal,
  normalizeTracking,
  ordinalDay,
  pendingEquipment,
  renewsToday,
  shippedMessage,
  trackingUrl,
  validateInternetPlanInput,
  validateShipInput,
  wifiKindsNotNeeded,
  type ShipInput,
  type Shipment,
} from '@/lib/hardware-shipping'

describe('needs', () => {
  it('defaults to needing a laptop and no wifi', () => {
    expect(deviceKindsNeeded(DEFAULT_NEEDS)).toEqual(['laptop'])
  })
  it('ships a hotspot or booster for that wifi choice, nothing for Comcast NOW', () => {
    expect(deviceKindsNeeded({ laptop: 'needs', wifi: 'hotspot' })).toEqual(['laptop', 'hotspot'])
    expect(deviceKindsNeeded({ laptop: 'own', wifi: 'booster' })).toEqual(['booster'])
    expect(deviceKindsNeeded({ laptop: 'own', wifi: 'comcast_now' })).toEqual([])
  })
  it('knows which wifi devices a choice rules out', () => {
    expect(wifiKindsNotNeeded('hotspot')).toEqual(['booster'])
    expect(wifiKindsNotNeeded('none')).toEqual(['hotspot', 'booster'])
  })
})

describe('tracking', () => {
  it('drops spaces and links to the carrier', () => {
    expect(normalizeTracking(' 9400 1000 0000 ')).toBe('940010000000')
    expect(trackingUrl('usps', '9400 111')).toBe('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111')
    expect(trackingUrl('ups', '1Z999')).toBe('https://www.ups.com/track?tracknum=1Z999')
    expect(trackingUrl('fedex', '7777')).toBe('https://www.fedex.com/fedextrack/?trknbr=7777')
    expect(trackingUrl('other', '7777')).toBeNull()
    expect(trackingUrl('usps', '   ')).toBeNull()
  })
})

describe('validateShipInput', () => {
  const base: ShipInput = { studentId: 's', loanDeviceIds: ['d1'], heldDeviceIds: [], carrier: 'usps', trackingNumber: '9400', shippedOn: '2026-12-12', notes: '' }
  it('accepts a complete form', () => expect(validateShipInput(base)).toBeNull())
  it('needs a device, a carrier, a tracking number and a date', () => {
    expect(validateShipInput({ ...base, loanDeviceIds: [] })).toMatch(/at least one device/)
    expect(validateShipInput({ ...base, carrier: 'dhl' as never })).toMatch(/carrier/)
    expect(validateShipInput({ ...base, trackingNumber: '  ' })).toMatch(/tracking number/)
    expect(validateShipInput({ ...base, shippedOn: '12/12/2026' })).toMatch(/date/)
  })
  it('refuses the same device twice', () => {
    expect(validateShipInput({ ...base, heldDeviceIds: ['d1'] })).toMatch(/twice/)
  })
})

describe('shippedMessage', () => {
  it('names what shipped and how to say it arrived', () => {
    const m = shippedMessage('Jordan Rivera', ['laptop', 'hotspot'], 'usps', '9400 123', 'https://lms/account#equipment')
    expect(m.subject).toBe('Your AnnieCannons laptop and hotspot are on the way')
    expect(m.bell).toBe('Your laptop and hotspot shipped! USPS tracking: 9400123')
    expect(m.text).toContain('Hi Jordan!')
    expect(m.text).toContain('https://tools.usps.com/go/TrackConfirmAction?tLabels=9400123')
    expect(m.text).toContain('"I got it"')
  })
  it('handles one item and no name', () => {
    const m = shippedMessage(null, ['laptop'], 'other', 'ABC', 'u')
    expect(m.subject).toBe('Your AnnieCannons laptop is on the way')
    expect(m.text.startsWith('Hi! ')).toBe(true)
    expect(kindList(['booster'])).toBe('wifi booster')
  })
})

describe('shipments', () => {
  const s = (id: string, devices: string[], shipped: string, received: string | null = null): Shipment =>
    ({ id, student_id: 'st', device_ids: devices, carrier: 'usps', tracking_number: id, shipped_on: shipped, received_at: received, received_by: null, notes: null, created_at: `${shipped}T10:00:00Z` })
  it('finds the latest box a device went out in', () => {
    const list = [s('old', ['d1'], '2026-01-05', '2026-01-08T00:00:00Z'), s('new', ['d1', 'd2'], '2026-12-12')]
    expect(latestShipmentFor('d1', list)?.id).toBe('new')
    expect(latestShipmentFor('d3', list)).toBeNull()
    expect(inTransit(list).map(x => x.id)).toEqual(['new'])
  })
})

describe('pendingEquipment', () => {
  const needs = { laptop: 'needs', wifi: 'hotspot' } as const
  it('asks them to finish first while Enrollment Readiness is in progress', () => {
    expect(pendingEquipment({ needs, heldKinds: [], waitingKinds: [], onboarding: 'in_progress' })).toEqual([
      { kind: 'laptop', state: 'finish_first' },
      { kind: 'hotspot', state: 'finish_first' },
    ])
  })
  it('says we’re preparing once they’ve finished or are on the waitlist', () => {
    expect(pendingEquipment({ needs, heldKinds: [], waitingKinds: ['laptop'], onboarding: 'finished' })).toEqual([
      { kind: 'laptop', state: 'preparing' },
      { kind: 'hotspot', state: 'preparing' },
    ])
    // a current student waiting for a replacement
    expect(pendingEquipment({ needs: DEFAULT_NEEDS, heldKinds: [], waitingKinds: ['booster'], onboarding: null })).toEqual([
      { kind: 'booster', state: 'preparing' },
    ])
  })
  it('drops what they already have', () => {
    expect(pendingEquipment({ needs, heldKinds: ['laptop', 'hotspot'], waitingKinds: [], onboarding: 'finished' })).toEqual([])
  })
  it('says nothing to students who aren’t onboarding or waiting', () => {
    expect(pendingEquipment({ needs: DEFAULT_NEEDS, heldKinds: [], waitingKinds: [], onboarding: null })).toEqual([])
  })
})

describe('Comcast NOW plans', () => {
  it('bills on the start day, moved back in short months', () => {
    expect(monthlyDate('2026-01-31', 2026, 2)).toBe('2026-02-28')
    expect(monthlyDate('2026-01-31', 2028, 2)).toBe('2028-02-29')
    expect(monthlyDate('2026-12-03', 2027, 1)).toBe('2027-01-03')
  })
  it('renews on each monthly anniversary, not on the start date, and stops after the end', () => {
    const plan = { starts_on: '2026-12-03', ends_on: null }
    expect(renewsToday(plan, '2026-12-03')).toBe(false)
    expect(renewsToday(plan, '2027-01-03')).toBe(true)
    expect(renewsToday(plan, '2027-01-04')).toBe(false)
    expect(renewsToday({ starts_on: '2026-12-03', ends_on: '2027-01-02' }, '2027-01-03')).toBe(false)
    expect(renewsToday({ starts_on: '2026-01-31', ends_on: null }, '2026-02-28')).toBe(true)
  })
  it('knows the next billing date', () => {
    const plan = { starts_on: '2026-12-03', ends_on: null }
    expect(nextRenewal(plan, '2026-12-03')).toBe('2027-01-03')
    expect(nextRenewal(plan, '2027-01-03')).toBe('2027-01-03')
    expect(nextRenewal(plan, '2027-01-04')).toBe('2027-02-03')
    expect(nextRenewal({ starts_on: '2026-12-03', ends_on: '2027-01-15' }, '2027-01-04')).toBeNull()
    expect(nextRenewal({ starts_on: '2026-12-03', ends_on: '2026-12-20' }, '2027-01-04')).toBeNull()
  })
  it('validates the plan form', () => {
    const ok = { accountNumber: '', monthlyCost: '$30.00', startsOn: '2026-12-03', endsOn: '', notes: '' }
    expect(validateInternetPlanInput(ok)).toBeNull()
    expect(validateInternetPlanInput({ ...ok, startsOn: '' })).toMatch(/started/)
    expect(validateInternetPlanInput({ ...ok, endsOn: '2026-12-01' })).toMatch(/before/)
    expect(validateInternetPlanInput({ ...ok, monthlyCost: 'thirty' })).toMatch(/number/)
  })
  it('writes billing days as ordinals', () => {
    expect(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-11', '2026-12-22', '2026-12-31'].map(ordinalDay))
      .toEqual(['1st', '2nd', '3rd', '11th', '22nd', '31st'])
  })
})

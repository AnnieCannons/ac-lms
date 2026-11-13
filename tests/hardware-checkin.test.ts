import { describe, it, expect } from 'vitest'
import { emptyCheckinInput, planCheckin, validateCheckinInput, type DeviceMatch } from '@/lib/hardware-checkin'

const device = (over: Partial<DeviceMatch>): DeviceMatch => ({
  id: 'd', asset_tag: 'LAP-001', kind: 'laptop', status: 'in_stock', current_holder_id: null,
  serial_number: null, imei: null, phone_number: null, ...over,
})

const response = (over: Record<string, unknown> = {}) => ({
  user_id: 's1', has_laptop: false, laptop_serial: null, has_hotspot: false, hotspot_imei: null, hotspot_phone: null,
  has_booster: false, laptop_replaced: false, charger_replaced: false, ...over,
})

describe('validateCheckinInput', () => {
  it('accepts "I have nothing"', () => {
    expect(validateCheckinInput(emptyCheckinInput())).toBeNull()
  })
  it('needs a serial when they have a laptop', () => {
    expect(validateCheckinInput({ ...emptyCheckinInput(), hasLaptop: true })).toMatch(/serial number/)
  })
  it('needs an IMEI or phone number when they have a hotspot', () => {
    expect(validateCheckinInput({ ...emptyCheckinInput(), hasHotspot: true })).toMatch(/IMEI or phone/)
    expect(validateCheckinInput({ ...emptyCheckinInput(), hasHotspot: true, hotspotPhone: '510-555-0100' })).toBeNull()
  })
})

describe('planCheckin', () => {
  const none = { laptop: 0, charger: 0 }

  it('creates a laptop that is not in the tracker yet', () => {
    expect(planCheckin(response({ has_laptop: true, laptop_serial: 'ABC' }), [], none).laptop).toEqual({ action: 'create' })
  })

  it('links an in-stock laptop by serial, ignoring case and spaces', () => {
    const d = device({ serial_number: 'abc ' })
    expect(planCheckin(response({ has_laptop: true, laptop_serial: ' ABC' }), [d], none).laptop).toEqual({ action: 'link', device: d })
  })

  it('leaves a laptop the student already has alone', () => {
    const d = device({ serial_number: 'ABC', current_holder_id: 's1', status: 'on_loan' })
    expect(planCheckin(response({ has_laptop: true, laptop_serial: 'ABC' }), [d], none).laptop).toEqual({ action: 'already', device: d })
  })

  it("flags a laptop that is with someone else or marked lost", () => {
    const other = device({ serial_number: 'ABC', current_holder_id: 's2', status: 'on_loan' })
    expect(planCheckin(response({ has_laptop: true, laptop_serial: 'ABC' }), [other], none).laptop).toMatchObject({ action: 'conflict' })
    const lost = device({ serial_number: 'ABC', status: 'lost' })
    expect(planCheckin(response({ has_laptop: true, laptop_serial: 'ABC' }), [lost], none).laptop).toMatchObject({ action: 'conflict', reason: expect.stringMatching(/lost/) })
  })

  it('matches a hotspot by IMEI, then by phone number digits', () => {
    const byImei = device({ id: 'h1', kind: 'hotspot', imei: '356938035643809' })
    const byPhone = device({ id: 'h2', kind: 'hotspot', phone_number: '(510) 555-0100' })
    expect(planCheckin(response({ has_hotspot: true, hotspot_imei: '356938035643809' }), [byImei, byPhone], none).hotspot).toEqual({ action: 'link', device: byImei })
    expect(planCheckin(response({ has_hotspot: true, hotspot_phone: '510.555.0100' }), [byImei, byPhone], none).hotspot).toEqual({ action: 'link', device: byPhone })
  })

  it('creates a booster unless the student already has one', () => {
    expect(planCheckin(response({ has_booster: true }), [], none).booster).toEqual({ action: 'create' })
    const held = device({ kind: 'booster', current_holder_id: 's1', status: 'on_loan' })
    expect(planCheckin(response({ has_booster: true }), [held], none).booster).toMatchObject({ action: 'already' })
  })

  it('records past replacements only once', () => {
    const r = response({ laptop_replaced: true, charger_replaced: true })
    expect(planCheckin(r, [], none)).toMatchObject({ laptopReplacement: true, chargerReplacement: true })
    expect(planCheckin(r, [], { laptop: 1, charger: 0 })).toMatchObject({ laptopReplacement: false, chargerReplacement: true })
  })

  it('does nothing for parts the student said no to', () => {
    expect(planCheckin(response(), [], none)).toEqual({
      laptop: { action: 'none' }, hotspot: { action: 'none' }, booster: { action: 'none' }, laptopReplacement: false, chargerReplacement: false,
    })
  })
})

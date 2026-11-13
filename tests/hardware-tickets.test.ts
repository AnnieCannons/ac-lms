import { describe, it, expect } from 'vitest'
import { kindsForEquipment, parseTicketPayload, pickTicketDevice, ticketNeedsNudge } from '@/lib/hardware-tickets'

describe('parseTicketPayload', () => {
  it('keeps only the expected fields, trimmed, and lowercases the email', () => {
    const p = parseTicketPayload({
      recordId: 'recAbc123', recordUrl: 'https://airtable.com/app1/tbl1/recAbc123', email: ' Ana@X.org ',
      name: 'Ana', equipment: 'Laptop', issue: ' Screen flickers ', otherInfo: '',
      streetAddress: '123 Main St', zip: '94605',
    })
    expect(p).toEqual({
      recordId: 'recAbc123', recordUrl: 'https://airtable.com/app1/tbl1/recAbc123', email: 'ana@x.org',
      name: 'Ana', equipment: 'Laptop', issue: 'Screen flickers', otherInfo: null,
    })
    expect(JSON.stringify(p)).not.toMatch(/Main St|94605/)
  })

  it('refuses a body without an Airtable record id', () => {
    expect(parseTicketPayload({ email: 'a@b.c' })).toMatchObject({ error: expect.any(String) })
    expect(parseTicketPayload({ recordId: 'drop table' })).toMatchObject({ error: expect.any(String) })
    expect(parseTicketPayload(null)).toMatchObject({ error: expect.any(String) })
  })

  it('drops a record link that is not on airtable.com', () => {
    expect(parseTicketPayload({ recordId: 'recAbc123', recordUrl: 'https://evil.example/x' })).toMatchObject({ recordUrl: null })
  })
})

describe('matching the device', () => {
  const laptop = { id: 'l', kind: 'laptop' as const }
  const hotspot = { id: 'h', kind: 'hotspot' as const }
  const booster = { id: 'b', kind: 'booster' as const }

  it('maps the form choices to device types', () => {
    expect(kindsForEquipment('Laptop')).toEqual(['laptop'])
    expect(kindsForEquipment('Laptop Charger')).toEqual(['laptop'])
    expect(kindsForEquipment('Wifi Unit')).toEqual(['hotspot', 'booster'])
    expect(kindsForEquipment('Other')).toEqual([])
  })

  it('picks the one device of that type, and nothing when it is ambiguous', () => {
    expect(pickTicketDevice([laptop, hotspot], 'Laptop Charger')).toBe(laptop)
    expect(pickTicketDevice([laptop, hotspot], 'Wifi Unit')).toBe(hotspot)
    expect(pickTicketDevice([hotspot, booster], 'Wifi Unit')).toBeNull()
    expect(pickTicketDevice([laptop], 'Other')).toBeNull()
  })
})

describe('ticketNeedsNudge', () => {
  const now = new Date('2026-10-20T15:30:00Z')
  it('nudges open tickets untouched for 48 hours, once per 48 hours', () => {
    expect(ticketNeedsNudge({ status: 'open', last_activity_at: '2026-10-18T15:00:00Z', last_nudged_at: null }, now)).toBe(true)
    expect(ticketNeedsNudge({ status: 'open', last_activity_at: '2026-10-19T15:00:00Z', last_nudged_at: null }, now)).toBe(false)
    expect(ticketNeedsNudge({ status: 'open', last_activity_at: '2026-10-10T15:00:00Z', last_nudged_at: '2026-10-19T15:30:00Z' }, now)).toBe(false)
    expect(ticketNeedsNudge({ status: 'resolved', last_activity_at: '2026-10-01T15:00:00Z', last_nudged_at: null }, now)).toBe(false)
  })
})

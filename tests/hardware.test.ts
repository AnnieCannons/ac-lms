import { describe, it, expect } from 'vitest'
import {
  batchSize,
  daysSince,
  isLikelyLost,
  statusChoices,
  isReadyToTransfer,
  laptopTrackFromName,
  validateReplacementInput,
  DEVICE_STATUSES,
  describeChanges,
  emptyDeviceInput,
  parseIdentifierList,
  primaryIdentifier,
  sanitizeSearch,
  validateBatchInput,
  validateDeviceInput,
  type BatchInput,
} from '@/lib/hardware'

const batch = (over: Partial<BatchInput> = {}): BatchInput => ({
  kind: 'laptop', purchasedOn: '2026-10-01', vendor: 'Back Market', makeModel: 'Dell Latitude 5420', modelYear: '2021', condition: 'refurbished',
  unitCost: '289.99', warrantyEndsOn: '', notes: '', identifiers: 'ABC1\nABC2', count: '', ...over,
})

describe('parseIdentifierList', () => {
  it('splits on new lines, commas and tabs and trims blanks', () => {
    expect(parseIdentifierList(' A1 \n\nB2,C3\tD4\n').identifiers).toEqual(['A1', 'B2', 'C3', 'D4'])
  })

  it('keeps the first spelling and reports repeats ignoring case', () => {
    expect(parseIdentifierList('abc\nDEF\nABC\nabc')).toEqual({ identifiers: ['abc', 'DEF'], repeated: ['abc'] })
  })
})

describe('validateDeviceInput', () => {
  it('needs a serial for a laptop', () => {
    expect(validateDeviceInput(emptyDeviceInput('laptop'))).toBe('A laptop needs a serial number.')
    expect(validateDeviceInput({ ...emptyDeviceInput('laptop'), serialNumber: 'X1' })).toBeNull()
  })

  it('needs an IMEI or phone number for a hotspot', () => {
    expect(validateDeviceInput(emptyDeviceInput('hotspot'))).toMatch(/IMEI or a phone number/)
    expect(validateDeviceInput({ ...emptyDeviceInput('hotspot'), phoneNumber: '555-0100' })).toBeNull()
  })

  it('accepts a booster with nothing filled in', () => {
    expect(validateDeviceInput(emptyDeviceInput('booster'))).toBeNull()
  })

  it('rejects a year that is not a 4-digit year', () => {
    expect(validateDeviceInput({ ...emptyDeviceInput('booster'), modelYear: '21' })).toMatch(/4-digit year/)
  })
})

describe('validateBatchInput and batchSize', () => {
  it('counts pasted identifiers for laptops', () => {
    expect(batchSize(batch())).toBe(2)
    expect(validateBatchInput(batch())).toBeNull()
  })

  it('refuses an empty paste and a repeated identifier', () => {
    expect(validateBatchInput(batch({ identifiers: ' \n ' }))).toBe('Paste at least one identifier.')
    expect(validateBatchInput(batch({ identifiers: 'A\na' }))).toBe('Pasted more than once: A')
  })

  it('uses the count for boosters and ignores pasted text', () => {
    expect(batchSize(batch({ kind: 'booster', identifiers: 'x\ny\nz', count: '5' }))).toBe(5)
    expect(validateBatchInput(batch({ kind: 'booster', count: '0' }))).toBe('Enter how many boosters to add.')
  })

  it('caps a batch at 200 devices', () => {
    expect(validateBatchInput(batch({ kind: 'booster', count: '201' }))).toMatch(/at most 200/)
  })

  it.each([
    ['makeModel', 'Enter the make and model.'],
    ['modelYear', 'Enter the year.'],
    ['condition', 'Choose a condition.'],
    ['vendor', 'Enter the vendor.'],
    ['purchasedOn', 'Enter the purchase date.'],
    ['unitCost', 'Enter the cost per device.'],
  ] as const)('requires %s', (field, message) => {
    expect(validateBatchInput(batch({ [field]: '' }))).toBe(message)
  })

  it('leaves warranty and notes optional', () => {
    expect(validateBatchInput(batch({ warrantyEndsOn: '', notes: '' }))).toBeNull()
  })

  it('rejects a cost that is not a number', () => {
    expect(validateBatchInput(batch({ unitCost: 'lots' }))).toMatch(/Cost must be a number/)
  })
})

describe('sanitizeSearch', () => {
  it('removes characters that would break a PostgREST or() filter', () => {
    expect(sanitizeSearch('a,b),id.eq.(x*%')).toBe('a b id.eq. x')
  })
})

describe('describeChanges', () => {
  it('lists only the changed fields', () => {
    const before = { ...emptyDeviceInput('laptop'), serialNumber: 'A', makeModel: 'Dell' }
    const after = { ...before, serialNumber: 'B', notes: 'cracked' }
    expect(describeChanges(before, after)).toEqual(['Serial number: A → B', 'Notes updated'])
  })
})

describe('primaryIdentifier', () => {
  it('prefers the IMEI for a hotspot and the serial otherwise', () => {
    expect(primaryIdentifier({ kind: 'hotspot', serial_number: 'S', imei: 'I', phone_number: 'P' })).toBe('I')
    expect(primaryIdentifier({ kind: 'hotspot', serial_number: null, imei: null, phone_number: 'P' })).toBe('P')
    expect(primaryIdentifier({ kind: 'laptop', serial_number: 'S', imei: 'I', phone_number: null })).toBe('S')
  })
})

describe('days waiting and likely lost', () => {
  const now = new Date('2026-12-15T12:00:00Z')
  it('counts whole days and never goes negative', () => {
    expect(daysSince('2026-12-14T13:00:00Z', now)).toBe(0)
    expect(daysSince('2026-12-05T12:00:00Z', now)).toBe(10)
    expect(daysSince('2026-12-20T12:00:00Z', now)).toBe(0)
  })
  it('flags 60 days or more as likely lost', () => {
    expect(isLikelyLost('2026-10-17T12:00:00Z', now)).toBe(false)
    expect(isLikelyLost('2026-10-16T12:00:00Z', now)).toBe(true)
  })
})

describe('statusChoices', () => {
  it('only offers loan-related changes for a device with a student', () => {
    expect(statusChoices('on_loan')).toEqual(['awaiting_return', 'receive'])
    expect(statusChoices('on_loan', 'laptop')).toEqual(['awaiting_return', 'receive', 'transfer'])
    expect(statusChoices('on_loan', 'hotspot')).not.toContain('transfer')
    expect(statusChoices('awaiting_return')).toEqual(['receive', 'back_on_loan', 'lost_while_out'])
  })
  it('offers loaning only from in stock', () => {
    for (const s of DEVICE_STATUSES) expect(statusChoices(s).includes('loan')).toBe(s === 'in_stock')
  })
  it('never offers the current status again', () => {
    for (const s of DEVICE_STATUSES) expect(statusChoices(s)).not.toContain(s)
  })
})

describe('isReadyToTransfer', () => {
  it('needs both TCF and ITP', () => {
    expect(isReadyToTransfer(['tcf'])).toBe(false)
    expect(isReadyToTransfer(['itp'])).toBe(false)
    expect(isReadyToTransfer(['tcf', 'itp'])).toBe(true)
  })
})

describe('validateReplacementInput', () => {
  const base = {
    studentId: 's1', kind: 'laptop' as const, oldDeviceId: 'a', newDeviceId: 'b', oldComingBack: true,
    writeOff: '' as const, writeOffReason: '', overrideNote: '', notes: '',
  }
  it('accepts a first laptop replacement with the old one coming back', () => {
    expect(validateReplacementInput(base, 0)).toBeNull()
  })
  it('needs both laptops and they must differ', () => {
    expect(validateReplacementInput({ ...base, newDeviceId: null }, 0)).toBe('Choose the laptop to send.')
    expect(validateReplacementInput({ ...base, newDeviceId: 'a' }, 0)).toBe('The new laptop must be a different one.')
  })
  it('needs a reason when the old one is not coming back', () => {
    expect(validateReplacementInput({ ...base, oldComingBack: false }, 0)).toBe('Choose why the old one is not coming back.')
    expect(validateReplacementInput({ ...base, oldComingBack: false, writeOff: 'lost' }, 0)).toBe('Say why the old one is not coming back.')
    expect(validateReplacementInput({ ...base, oldComingBack: false, writeOff: 'lost', writeOffReason: 'stolen from car' }, 0)).toBeNull()
  })
  it('needs an override note once the one replacement is used', () => {
    expect(validateReplacementInput(base, 1)).toMatch(/already used/)
    expect(validateReplacementInput({ ...base, overrideNote: 'house fire' }, 1)).toBeNull()
  })
  it('lets a charger be replaced without any laptops chosen', () => {
    expect(validateReplacementInput({ ...base, kind: 'charger', oldDeviceId: null, newDeviceId: null }, 0)).toBeNull()
  })
})

describe('laptopTrackFromName', () => {
  it('reads the track from the start of the course name, ignoring case', () => {
    expect(laptopTrackFromName('Tech Career Foundations (Sept 2026)')).toBe('tcf')
    expect(laptopTrackFromName('intro to programming (May 2026)')).toBe('itp')
  })
  it('ignores other courses, including break exercises that mention ITP', () => {
    expect(laptopTrackFromName('Winter Break ITP Exercises 2026')).toBeNull()
    expect(laptopTrackFromName('Advanced Frontend (Fall 2026)')).toBeNull()
    expect(laptopTrackFromName(null)).toBeNull()
  })
})

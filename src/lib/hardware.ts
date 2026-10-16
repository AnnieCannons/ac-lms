// Pure rules for the Hardware Tracker (no database access). See _plans/hardware-tracker-roadmap.md.

export const DEVICE_KINDS = ['laptop', 'hotspot', 'booster'] as const
export type DeviceKind = (typeof DEVICE_KINDS)[number]

export const DEVICE_STATUSES = [
  'in_stock', 'on_loan', 'owned_by_student', 'awaiting_return',
  'received', 'needs_prep', 'needs_repair', 'lost', 'retired',
] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

export const DEVICE_CONDITIONS = ['new', 'refurbished', 'used'] as const
export type DeviceCondition = (typeof DEVICE_CONDITIONS)[number]

export const KIND_LABELS: Record<DeviceKind, string> = {
  laptop: 'Laptop',
  hotspot: 'Hotspot',
  booster: 'Wifi booster',
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  in_stock: 'In stock',
  on_loan: 'On loan',
  owned_by_student: 'Owned by student',
  awaiting_return: 'Awaiting return',
  received: 'Received',
  needs_prep: 'Needs prep',
  needs_repair: 'Needs repair',
  lost: 'Lost',
  retired: 'Retired',
}

export const CONDITION_LABELS: Record<DeviceCondition, string> = {
  new: 'New',
  refurbished: 'Refurbished',
  used: 'Used',
}

/** History entry types. */
export const EVENT_LABELS: Record<string, string> = {
  added: 'Added',
  edited: 'Details edited',
  status_changed: 'Status changed',
  note: 'Note',
  loaned: 'Loaned',
  awaiting_return: 'Marked awaiting return',
  return_cancelled: 'Return no longer needed',
  received: 'Received',
  prepped: 'Wiped and checked',
  marked_lost: 'Marked lost',
}

/** Statuses a device can go to when it comes back from a student. */
export const RECEIVE_STATUSES = ['needs_prep', 'in_stock', 'needs_repair'] as const
export type ReceiveStatus = (typeof RECEIVE_STATUSES)[number]

/** After this many days awaiting return, a device shows as likely lost for staff to confirm. */
export const LIKELY_LOST_DAYS = 60

/** The first reminder to send the student goes out this long after a return is requested. */
export const FIRST_RETURN_REMINDER_HOURS = 48

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days from `iso` to `now` (never negative). */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS))
}

export function isLikelyLost(requestedAt: string, now: Date = new Date()): boolean {
  return daysSince(requestedAt, now) >= LIKELY_LOST_DAYS
}

export type ReturnRequest = {
  id: string
  device_id: string
  student_id: string | null
  requested_at: string
  closed_at: string | null
  closed_reason: string | null
}

export type HardwareDevice = {
  id: string
  kind: DeviceKind
  asset_tag: string | null
  serial_number: string | null
  imei: string | null
  iccid: string | null
  phone_number: string | null
  make_model: string | null
  model_year: number | null
  condition: DeviceCondition | null
  purchase_batch_id: string | null
  status: DeviceStatus
  current_holder_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type HardwareEvent = {
  id: string
  device_id: string | null
  student_id: string | null
  type: string
  notes: string | null
  actor_id: string | null
  created_at: string
}

/** Editable fields of one device. Empty strings mean "not set". */
export type DeviceInput = {
  kind: DeviceKind
  serialNumber: string
  imei: string
  iccid: string
  phoneNumber: string
  makeModel: string
  modelYear: string
  condition: DeviceCondition | ''
  notes: string
}

/** Details shared by every device in one purchase, plus the pasted serial numbers. */
export type BatchInput = {
  kind: DeviceKind
  purchasedOn: string
  vendor: string
  makeModel: string
  modelYear: string
  condition: DeviceCondition | ''
  unitCost: string
  warrantyEndsOn: string
  notes: string
  /** For laptops and hotspots: one identifier per line. Ignored for boosters. */
  identifiers: string
  /** For boosters, which have no manufacturer number: how many to create. */
  count: string
}

export const MAX_BATCH_SIZE = 200

export const emptyDeviceInput = (kind: DeviceKind = 'laptop'): DeviceInput => ({
  kind, serialNumber: '', imei: '', iccid: '', phoneNumber: '', makeModel: '', modelYear: '', condition: '', notes: '',
})

/** Comparison key for serial numbers: case and surrounding spaces don't matter. */
export const serialKey = (s: string) => s.trim().toLowerCase()

/**
 * Splits pasted text (one per line; commas and tabs also work, so a spreadsheet column
 * pastes cleanly) into unique identifiers, keeping first-seen order, and reports the
 * ones pasted more than once.
 */
export function parseIdentifierList(text: string): { identifiers: string[]; repeated: string[] } {
  const seen = new Map<string, string>()
  const repeated = new Set<string>()
  for (const raw of text.split(/[\n,\t]+/)) {
    const value = raw.trim()
    if (!value) continue
    const key = serialKey(value)
    if (seen.has(key)) repeated.add(seen.get(key)!)
    else seen.set(key, value)
  }
  return { identifiers: [...seen.values()], repeated: [...repeated] }
}

function validYear(year: string): boolean {
  if (!year.trim()) return true
  const n = Number(year)
  return Number.isInteger(n) && n >= 2000 && n <= 2100
}

/** Returns an error message, or null when the device can be saved. */
export function validateDeviceInput(input: DeviceInput): string | null {
  if (!DEVICE_KINDS.includes(input.kind)) return 'Choose a device type.'
  if (input.condition && !DEVICE_CONDITIONS.includes(input.condition)) return 'Choose a valid condition.'
  if (!validYear(input.modelYear)) return 'Year must be a 4-digit year, like 2021.'
  if (input.kind === 'laptop' && !input.serialNumber.trim()) return 'A laptop needs a serial number.'
  if (input.kind === 'hotspot' && !input.imei.trim() && !input.phoneNumber.trim()) {
    return 'A hotspot needs an IMEI or a phone number.'
  }
  return null
}

/** Returns an error message, or null when the batch can be saved. */
export function validateBatchInput(input: BatchInput): string | null {
  if (!DEVICE_KINDS.includes(input.kind)) return 'Choose a device type.'
  // Everything about a purchase is required except the warranty date and notes.
  if (!input.makeModel.trim()) return 'Enter the make and model.'
  if (!input.modelYear.trim()) return 'Enter the year.'
  if (!validYear(input.modelYear)) return 'Year must be a 4-digit year, like 2021.'
  if (!input.condition || !DEVICE_CONDITIONS.includes(input.condition)) return 'Choose a condition.'
  if (!input.vendor.trim()) return 'Enter the vendor.'
  if (!input.purchasedOn) return 'Enter the purchase date.'
  if (!input.unitCost.trim()) return 'Enter the cost per device.'
  if (!(Number(input.unitCost) >= 0)) return 'Cost must be a number, like 289.99.'
  const size = batchSize(input)
  if (size === 0) {
    return input.kind === 'booster' ? 'Enter how many boosters to add.' : 'Paste at least one identifier.'
  }
  if (size > MAX_BATCH_SIZE) return `Add at most ${MAX_BATCH_SIZE} devices at a time.`
  const { repeated } = parseIdentifierList(input.identifiers)
  if (input.kind !== 'booster' && repeated.length > 0) return `Pasted more than once: ${repeated.join(', ')}`
  return null
}

/** How many devices the batch will create. */
export function batchSize(input: BatchInput): number {
  if (input.kind === 'booster') {
    const n = Number(input.count)
    return Number.isInteger(n) && n > 0 ? n : 0
  }
  return parseIdentifierList(input.identifiers).identifiers.length
}

/** Which device column the pasted identifiers go into for a batch of this kind. */
export function batchIdentifierField(kind: DeviceKind): 'serial_number' | 'imei' | null {
  if (kind === 'laptop') return 'serial_number'
  if (kind === 'hotspot') return 'imei'
  return null
}

/** Trimmed value, or null when blank. */
export const blankToNull = (s: string): string | null => (s.trim() ? s.trim() : null)

/**
 * Strips characters that would change the meaning of a PostgREST `or=(...)` filter, so a
 * search box value can be interpolated into `.or()` safely.
 */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** Lists the fields that differ, as "Serial number: A → B", for the history timeline. */
export function describeChanges(before: DeviceInput, after: DeviceInput): string[] {
  const fields: [keyof DeviceInput, string][] = [
    ['serialNumber', 'Serial number'], ['imei', 'IMEI'], ['iccid', 'ICCID'], ['phoneNumber', 'Phone number'],
    ['makeModel', 'Model'], ['modelYear', 'Year'], ['condition', 'Condition'], ['notes', 'Notes'],
  ]
  const show = (v: string) => (v.trim() ? v.trim() : '(blank)')
  return fields
    .filter(([k]) => before[k].trim() !== after[k].trim())
    .map(([k, label]) => (k === 'notes' ? 'Notes updated' : `${label}: ${show(before[k])} → ${show(after[k])}`))
}

export function deviceToInput(d: HardwareDevice): DeviceInput {
  return {
    kind: d.kind,
    serialNumber: d.serial_number ?? '',
    imei: d.imei ?? '',
    iccid: d.iccid ?? '',
    phoneNumber: d.phone_number ?? '',
    makeModel: d.make_model ?? '',
    modelYear: d.model_year != null ? String(d.model_year) : '',
    condition: d.condition ?? '',
    notes: d.notes ?? '',
  }
}

/** The number staff will recognise first for this device. */
export function primaryIdentifier(d: Pick<HardwareDevice, 'kind' | 'serial_number' | 'imei' | 'phone_number'>): string | null {
  if (d.kind === 'hotspot') return d.imei || d.phone_number || d.serial_number
  return d.serial_number
}

/** A timestamp in Pacific time, e.g. "Oct 16, 2026, 9:05 AM" (the team works in Pacific). */
export function formatPacific(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** A date-only value ("2026-10-01") as "Oct 1, 2026", without shifting the day. */
export function formatDateOnly(value: string | null): string {
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A choice in the device page's status dropdown and the form it opens. */
export type StatusChoice =
  | 'loan' | 'awaiting_return' | 'receive' | 'back_on_loan' | 'lost_while_out'
  | 'prepped' | 'in_stock' | 'needs_prep' | 'needs_repair' | 'lost' | 'retired'

export const STATUS_CHOICE_LABELS: Record<StatusChoice, string> = {
  loan: 'On loan (choose a student)',
  awaiting_return: 'Awaiting return',
  receive: 'Received',
  back_on_loan: 'Back on loan (no longer needed back)',
  lost_while_out: 'Lost',
  prepped: 'In stock (wiped and checked)',
  in_stock: 'In stock',
  needs_prep: 'Needs prep',
  needs_repair: 'Needs repair',
  lost: 'Lost',
  retired: 'Retired',
}

/**
 * The status changes that make sense from a device's current status, in the order the
 * dropdown lists them. Becoming the student's own laptop is a separate step (ownership).
 */
export function statusChoices(status: DeviceStatus): StatusChoice[] {
  switch (status) {
    case 'in_stock': return ['loan', 'needs_prep', 'needs_repair', 'lost', 'retired']
    case 'on_loan': return ['awaiting_return', 'receive']
    case 'awaiting_return': return ['receive', 'back_on_loan', 'lost_while_out']
    case 'needs_prep': return ['prepped', 'needs_repair', 'lost', 'retired']
    case 'needs_repair': return ['in_stock', 'needs_prep', 'lost', 'retired']
    case 'received': return ['needs_prep', 'in_stock', 'needs_repair']
    case 'lost': return ['in_stock', 'retired']
    case 'retired': return ['in_stock']
    case 'owned_by_student': return []
  }
}

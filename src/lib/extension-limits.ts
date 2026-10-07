// Shared by the student request form (to limit the date picker) and
// submitExtensionRequest (to enforce it server-side). Lives outside
// extension-actions.ts because a 'use server' module can only export async functions.

export const MAX_EXTENSION_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

// Latest due date a student may request: 7 days past the due date they currently
// have, or 7 days from now if the assignment is already overdue (or has no due date).
export function maxExtensionDate(currentDueDate: string | null, now: Date = new Date()): Date {
  const due = currentDueDate ? new Date(currentDueDate) : null
  const base = due && due.getTime() > now.getTime() ? due : now
  return new Date(base.getTime() + MAX_EXTENSION_DAYS * DAY_MS)
}

// The picker lets the student choose the cap's calendar day, and the request is
// then set to 11:59pm ET on that day — which can land up to a day after the exact
// cap timestamp depending on timezone. Allow that one-day slack server-side.
export function isWithinExtensionLimit(requestedDueDate: string, currentDueDate: string | null, now: Date = new Date()): boolean {
  const requested = new Date(requestedDueDate).getTime()
  if (Number.isNaN(requested)) return false
  return requested < maxExtensionDate(currentDueDate, now).getTime() + DAY_MS
}

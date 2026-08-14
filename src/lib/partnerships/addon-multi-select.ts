// Normalizes the Gmail add-on's department/reminder inputs, which may arrive
// as either a single legacy value or an array from the new checkbox UI.
export function normalizeDepartments(body: { departments?: unknown; department?: unknown }): string[] {
  if (Array.isArray(body.departments)) return body.departments.filter(Boolean) as string[]
  if (body.department) return [body.department as string]
  return []
}

export function normalizeRemindDays(body: { remind_in_days?: unknown }): number[] {
  const raw = Array.isArray(body.remind_in_days) ? body.remind_in_days : [body.remind_in_days]
  return raw.map(Number).filter((d) => d > 0)
}

/**
 * Copies only the listed keys that are present on `obj`. Use it before spreading a
 * client-sent object into a Supabase insert/update, so a caller can't slip in
 * columns the form never edits (ids, audit fields, foreign keys). Keys absent from
 * `obj` stay absent, so partial updates keep working.
 */
export function pickFields<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]
  }
  return out
}

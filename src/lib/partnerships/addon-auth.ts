import { createHash, timingSafeEqual } from 'crypto'

/**
 * Checks the Gmail add-on's shared key (x-addon-api-key) against ADDON_API_KEY in
 * constant time. Both sides are hashed first so a length difference doesn't leak
 * through timingSafeEqual throwing early. Fails closed when the env var is unset.
 */
export function checkAddonApiKey(req: Request): boolean {
  const expected = process.env.ADDON_API_KEY
  const key = req.headers.get('x-addon-api-key')
  if (!expected || !key) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(key), digest(expected))
}

/**
 * Ensures a user-entered URL has a protocol so it navigates to an external
 * site rather than being treated as a relative path.
 *
 * - Already has a protocol (http/https/ftp/…) → returned as-is
 * - Protocol-relative (//example.com) → https: prepended
 * - No protocol (www.example.com) → https:// prepended
 * - Empty / null → fallback returned (defaults to '#')
 */
export function normalizeUrl(url: string | null | undefined, fallback = '#'): string {
  if (!url?.trim()) return fallback
  const trimmed = url.trim()
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) return trimmed  // has protocol
  if (trimmed.startsWith('//')) return `https:${trimmed}`             // protocol-relative
  return `https://${trimmed}`
}

/**
 * Lowercases and strips all whitespace/punctuation, so "Node.js", "Node JS",
 * and "node  js" all normalize identically. Used both to detect near-duplicate
 * confidence-tracker skill names and to filter suggestions as the instructor types.
 */
export function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

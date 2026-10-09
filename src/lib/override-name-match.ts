// Matches a pasted list of student names (from a spreadsheet, Slack, etc.) to
// the students enrolled in a course, for bulk assignment overrides. Pure, so
// the instructor can see exactly what matched before anything is saved.

export type MatchStudent = { id: string; name: string }

export type NameMatchResult = {
  matched: { input: string; student: MatchStudent }[]
  ambiguous: { input: string; candidates: MatchStudent[] }[]
  unmatched: string[]
}

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents: "José" matches "Jose"
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\- ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** One name per line, or separated by commas, semicolons or tabs. */
export function splitPastedNames(text: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of text.split(/[\n\r,;\t]+/)) {
    const name = raw.trim()
    const key = normalize(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

/** True when every pasted word appears in the student's name, in order. */
function wordsInOrder(inputWords: string[], nameWords: string[]): boolean {
  let i = 0
  for (const w of nameWords) if (w === inputWords[i]) i++
  return i === inputWords.length
}

/**
 * Tries, in order, stopping at the first rule that finds anyone:
 * 1. full name (ignoring case, accents, extra spaces)
 * 2. a single word that's a student's first name
 * 3. every pasted word appears in the name in order ("Maria Garcia" → "Maria Lopez Garcia")
 * More than one student at a step is ambiguous rather than a guess.
 */
export function matchStudentNames(text: string, students: MatchStudent[]): NameMatchResult {
  const result: NameMatchResult = { matched: [], ambiguous: [], unmatched: [] }
  const prepared = students.map(s => ({ student: s, norm: normalize(s.name), words: normalize(s.name).split(' ') }))
  const matchedIds = new Set<string>()

  for (const input of splitPastedNames(text)) {
    const norm = normalize(input)
    const words = norm.split(' ')

    let candidates = prepared.filter(p => p.norm === norm)
    if (candidates.length === 0 && words.length === 1) candidates = prepared.filter(p => p.words[0] === norm)
    if (candidates.length === 0 && words.length > 1) candidates = prepared.filter(p => wordsInOrder(words, p.words))

    if (candidates.length === 1) {
      const student = candidates[0].student
      if (!matchedIds.has(student.id)) {
        matchedIds.add(student.id)
        result.matched.push({ input, student })
      }
    } else if (candidates.length > 1) {
      result.ambiguous.push({ input, candidates: candidates.map(c => c.student) })
    } else {
      result.unmatched.push(input)
    }
  }
  return result
}

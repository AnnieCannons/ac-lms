// A blank line separates one card from the next. Pasted content spells a blank line
// several ways: an empty <p>, one holding only <br>/&nbsp;/an empty <span> (Google
// Docs, Notes), or two <br>s in a row inside one paragraph (Shift+Enter, some apps).
const EMPTY_PARAGRAPH = /<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>|<span\b[^>]*>(?:\s|&nbsp;)*<\/span>)*<\/p>/gi
const DOUBLE_BREAK = /(?:<br\s*\/?>\s*){2,}/gi
const FIRST_BLOCK = /^(<(?:p|h[1-6]|pre|blockquote|ul|ol)[^>]*>[\s\S]*?<\/(?:p|h[1-6]|pre|blockquote|ul|ol)>)/i

/** Bulk-import HTML → cards: first block of each section is the front, the rest the back. */
export function parseCardsFromHtml(html: string): Array<{ front: string; back: string }> {
  const sections = html
    .replace(DOUBLE_BREAK, '</p><p></p><p>')
    .split(EMPTY_PARAGRAPH)
    .map(s => s.trim())
    .filter(Boolean)

  return sections.flatMap(section => {
    const match = section.match(FIRST_BLOCK)
    if (!match) return []
    const front = match[1].trim()
    const back = section.slice(match[0].length).trim()
    if (!front) return []
    return [{ front, back }]
  })
}

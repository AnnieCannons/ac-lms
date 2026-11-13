// Where My Decks' "Back" link goes. Flashcards are opened from a course's Level Up page
// (/flashcards?from=...), and that origin is remembered for the tab so Back still returns there
// after visiting decks, studying, or editing (pages that link to /flashcards without ?from).
// A fixed destination, not browser history, so Back never bounces between My Decks and a deck.

const KEY = 'flashcards-return'

/** Only course pages inside the app are accepted, so ?from can't send anyone off-site. */
export function safeReturnPath(path: string | null | undefined): string | null {
  if (!path) return null
  return /^\/(student|instructor)\/courses\/[A-Za-z0-9-]+(\/[A-Za-z0-9-]+)*$/.test(path) ? path : null
}

export function returnLabel(path: string | null): string {
  if (!path) return 'Back to Home'
  return path.endsWith('/level-up') ? 'Back to Level Up' : 'Back to Course'
}

export function rememberFlashcardsReturn(path: string | null) {
  const safe = safeReturnPath(path)
  if (!safe) return
  try { sessionStorage.setItem(KEY, safe) } catch { /* ignore */ }
}

export function readFlashcardsReturn(): string | null {
  try { return safeReturnPath(sessionStorage.getItem(KEY)) } catch { return null }
}

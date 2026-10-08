// Client-only record of the in-app pages visited in this tab, so a "← Back" link
// can behave like the browser's back button (returning to exactly where the user
// came from) when that's safe, and fall back to a fixed parent link when it isn't
// (first page in the tab, or the previous page was a form that's already been
// submitted). Kept in sessionStorage, which is per-tab, like browser history.

const TRAIL_KEY = 'nav-trail'
const MAX_TRAIL = 50

// Pages that are forms -- going "back" into one after it has redirected
// somewhere would just show the stale form again.
const FORM_PATH = /\/(new|edit|bulk-import)(\/|$)/

let lastPop: string | null = null
// The page this document was loaded on, and whether we've client-navigated away
// from it since -- a reload only "restores" that first page.
const loadPath = typeof window !== 'undefined' ? window.location.pathname : null
let navigatedSinceLoad = false

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { lastPop = window.location.pathname })
}

function readTrail(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeTrail(trail: string[]) {
  try { sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-MAX_TRAIL))) } catch { /* ignore */ }
}

/** Called by NavTracker whenever the pathname changes. */
export function recordNavigation(pathname: string) {
  if (pathname !== loadPath) navigatedSinceLoad = true
  const trail = readTrail()
  if (lastPop === pathname) {
    // Back/forward button: rewind the trail to that page if it's in it (it can
    // be more than one step back when pages were replaced rather than pushed),
    // otherwise it was a forward step.
    const i = trail.lastIndexOf(pathname, trail.length - 2)
    if (i >= 0) trail.length = i + 1
    else if (trail[trail.length - 1] !== pathname) trail.push(pathname)
  } else {
    lastPop = null
    if (trail[trail.length - 1] !== pathname) trail.push(pathname)
  }
  writeTrail(trail)
}

/** True when the previous page in this tab is an in-app page worth going back to. */
export function canGoBackInApp(): boolean {
  const trail = readTrail()
  const prev = trail[trail.length - 2]
  return !!prev && trail[trail.length - 1] === window.location.pathname && !FORM_PATH.test(prev)
}

/**
 * True when the current page was reached with the browser's back/forward
 * button (or a "← Back" link, which uses it), or by reloading -- i.e. the user
 * expects to see the page as they left it rather than freshly reset.
 */
export function arrivedViaHistory(): boolean {
  if (lastPop === window.location.pathname) return true
  if (navigatedSinceLoad || window.location.pathname !== loadPath) return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload' || nav?.type === 'back_forward'
}

import type { KeyboardEvent } from 'react'

// One Tab stop per group, arrow keys between its items (the "roving tabindex" pattern).
// Put this on the group's onKeyDown; items carry tabIndex 0 (the group's stop) or -1.
// Returns the index focus moved to, or null when the key isn't one it handles. Moving focus
// never selects anything — Space/Enter on the item still does that.
export function moveRovingFocus(e: KeyboardEvent<HTMLElement>, itemSelector: string): number | null {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(itemSelector))
    .filter(el => !(el as HTMLButtonElement).disabled)
  if (items.length === 0) return null
  const current = items.indexOf(document.activeElement as HTMLElement)
  if (current === -1) return null
  let next: number
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown': next = (current + 1) % items.length; break
    case 'ArrowLeft':
    case 'ArrowUp': next = (current - 1 + items.length) % items.length; break
    case 'Home': next = 0; break
    case 'End': next = items.length - 1; break
    default: return null
  }
  e.preventDefault()
  items[next].focus()
  return next
}

import { RefObject, useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(ref: RefObject<HTMLElement | null>, onEscape: () => void) {
  const escapeRef = useRef(onEscape)
  useEffect(() => { escapeRef.current = onEscape })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
    items[0]?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { escapeRef.current(); return }
      if (e.key !== 'Tab' || items.length === 0) return
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [ref])
}

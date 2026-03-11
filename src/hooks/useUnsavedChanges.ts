'use client'
import { useEffect, useRef } from 'react'

const SENTINEL = '__unsaved_sentinel'

export function useUnsavedChanges(isDirty: boolean) {
  const removingSentinelRef = useRef(false)

  useEffect(() => {
    if (!isDirty) {
      // Remove the sentinel we pushed so the real back button works normally
      if (history.state?.[SENTINEL]) {
        removingSentinelRef.current = true
        history.back()
      }
      return
    }

    // 1. Tab close / browser refresh / hard navigation to another origin
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    // 2. In-app link clicks (Next.js <Link> renders as <a> tags)
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
      if (anchor.hasAttribute('download')) return
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    // 3. Browser back/forward button:
    //    Push a sentinel entry (same URL) so the first back press hits it.
    //    We intercept that popstate and ask the user before actually leaving.
    history.pushState({ [SENTINEL]: true }, '', location.href)

    const handlePopState = () => {
      if (removingSentinelRef.current) {
        removingSentinelRef.current = false
        return
      }
      if (window.confirm('You have unsaved changes. Leave without saving?')) {
        // Confirmed leave — go back one more step to actually navigate away
        history.go(-1)
      } else {
        // Stay — re-push the sentinel so back button works again next time
        history.pushState({ [SENTINEL]: true }, '', location.href)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true) // capture phase
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isDirty])
}

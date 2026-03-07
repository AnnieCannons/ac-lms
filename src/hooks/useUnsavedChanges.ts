'use client'
import { useEffect } from 'react'

export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    // Intercept link clicks (Next.js <Link> renders as <a>)
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      // Ignore: no href, same-page anchors, external links, downloads
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return
      if (anchor.hasAttribute('download')) return

      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleClick, true) // capture phase

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleClick, true)
    }
  }, [isDirty])
}

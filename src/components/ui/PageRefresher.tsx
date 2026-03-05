'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Triggers router.refresh() when the page is restored from the browser's
// back/forward cache (bfcache), so server-fetched data is always current.
export default function PageRefresher() {
  const router = useRouter()
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh()
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [router])
  return null
}

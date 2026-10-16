'use client'
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { canGoBackInApp } from '@/lib/nav-trail'

const noopSubscribe = () => () => {}

/**
 * A "← Back" link that returns to wherever the user actually came from (same
 * as the browser back button, so the previous page restores its state), and
 * falls back to a fixed parent page when there's nowhere in-app to go back to
 * -- e.g. the page was opened directly from a bookmark or Slack link.
 */
export default function SmartBackLink({
  fallbackHref,
  fallbackLabel,
  className = 'text-sm text-muted-text hover:text-teal-primary transition-colors',
}: {
  fallbackHref: string
  fallbackLabel: string
  className?: string
}) {
  const router = useRouter()
  // false on the server (no sessionStorage) and during hydration, then the real answer
  const canGoBack = useSyncExternalStore(noopSubscribe, canGoBackInApp, () => false)

  return (
    <Link
      href={fallbackHref}
      className={className}
      onClick={e => {
        if (!canGoBack || e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        router.back()
      }}
    >
      ← {canGoBack ? 'Back' : fallbackLabel}
    </Link>
  )
}

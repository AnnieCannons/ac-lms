'use client'
import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * An event's start time in the viewer's own timezone ("Friday, October 23, 2026 at 12:00 PM
 * PDT"). The server doesn't know the viewer's timezone, so nothing renders until hydration.
 */
export default function LocalEventTime({ iso, dateOnly }: { iso: string; dateOnly?: boolean }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!isClient) return <span className="opacity-0">…</span>
  const d = new Date(iso)
  const date = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (dateOnly) return <span>{date}</span>
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
  return <span>{date} at {time}</span>
}

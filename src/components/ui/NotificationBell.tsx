'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/notification-actions'
import type { Notification } from '@/lib/notification-actions'

function BellIcon({ unread }: { unread: boolean }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={unread ? 'currentColor' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function notificationHref(n: Notification): string | null {
  if (n.course_id && n.assignment_id) {
    return `/student/courses/${n.course_id}/assignments/${n.assignment_id}`
  }
  if (n.course_id) {
    return `/student/courses/${n.course_id}`
  }
  return null
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    getMyNotifications().then(data => {
      setNotifications(data)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unreadCount = notifications.filter(n => !n.read).length

  async function handleOpen() {
    setOpen(o => !o)
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleClickNotification(n: Notification) {
    if (!n.read) {
      await markNotificationRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    const href = notificationHref(n)
    setOpen(false)
    if (href) router.push(href)
  }

  if (!loaded) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative text-muted-text hover:text-teal-primary transition-colors"
      >
        <BellIcon unread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-teal-primary text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-dark-text">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-teal-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-text text-center">
              No notifications yet
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-border">
              {notifications.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-background transition-colors ${!n.read ? 'bg-teal-light/30' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-teal-primary" />
                      )}
                      <div className={!n.read ? '' : 'pl-4'}>
                        <p className="text-sm text-dark-text leading-snug">{n.message}</p>
                        <p className="text-xs text-muted-text mt-0.5">{relativeTime(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

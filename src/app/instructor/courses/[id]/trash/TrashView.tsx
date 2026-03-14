'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { restoreItem, permanentlyDeleteItem, emptyTrash, type TrashedItem } from '@/lib/trash-actions'

const TYPE_LABELS: Record<string, string> = {
  module: 'Module',
  day: 'Day',
  assignment: 'Assignment',
  resource: 'Resource',
  quiz: 'Quiz',
}

const TYPE_ORDER = ['module', 'day', 'assignment', 'resource', 'quiz']

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function expiresIn(dateStr: string): string {
  const deletesAt = new Date(dateStr).getTime() + 7 * 24 * 60 * 60 * 1000
  const diff = deletesAt - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Expired'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days}d`
}

function itemContext(item: TrashedItem): string | null {
  if (item.module_title && item.day_name) return `${item.module_title} › ${item.day_name}`
  if (item.module_title) return item.module_title
  if (item.day_name) return item.day_name
  return null
}

export default function TrashView({ courseId, initialItems }: { courseId: string; initialItems: TrashedItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  // Keep the weekly popup flag in sync
  useEffect(() => {
    try {
      if (initialItems.length > 0) {
        localStorage.setItem(`trashHasItems_${courseId}`, 'true')
      } else {
        localStorage.removeItem(`trashHasItems_${courseId}`)
      }
    } catch {}
  }, [courseId, initialItems.length])

  const grouped = TYPE_ORDER.map(type => ({
    type,
    label: TYPE_LABELS[type],
    items: items.filter(i => i.type === type),
  })).filter(g => g.items.length > 0)

  const handleRestore = (item: TrashedItem) => {
    setActionId(item.id)
    startTransition(async () => {
      const { error } = await restoreItem(item.type, item.id, courseId)
      if (error) { alert(error); setActionId(null); return }
      setItems(prev => {
        const next = prev.filter(i => i.id !== item.id)
        if (next.length === 0) { try { localStorage.removeItem(`trashHasItems_${courseId}`) } catch {} }
        return next
      })
      setActionId(null)
      router.refresh()
    })
  }

  const handleDelete = (item: TrashedItem) => {
    if (!window.confirm(`Permanently delete "${item.title}"? This cannot be undone.`)) return
    setActionId(item.id)
    startTransition(async () => {
      const { error } = await permanentlyDeleteItem(item.type, item.id, courseId)
      if (error) { alert(error); setActionId(null); return }
      setItems(prev => {
        const next = prev.filter(i => i.id !== item.id)
        if (next.length === 0) { try { localStorage.removeItem(`trashHasItems_${courseId}`) } catch {} }
        return next
      })
      setActionId(null)
    })
  }

  const handleEmptyTrash = () => {
    if (!window.confirm(`Permanently delete all ${items.length} trashed item${items.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    startTransition(async () => {
      const { error } = await emptyTrash(courseId)
      if (error) { alert(error); return }
      setItems([])
      try { localStorage.removeItem(`trashHasItems_${courseId}`) } catch {}
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-4xl mb-4">🗑️</p>
        <p className="text-dark-text font-medium mb-1">Trash is empty</p>
        <p className="text-muted-text text-sm">Deleted modules, days, assignments, resources, and quizzes will appear here for 7 days before being permanently removed.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={handleEmptyTrash}
          disabled={isPending}
          className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          Empty trash
        </button>
      </div>

      <div className="space-y-8">
        {grouped.map(group => (
          <div key={group.type}>
            <h2 className="text-xs font-semibold text-muted-text uppercase tracking-widest mb-3">
              {group.label}s
            </h2>
            <div className="space-y-2">
              {group.items.map(item => {
                const context = itemContext(item)
                const busy = isPending && actionId === item.id
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 bg-surface rounded-xl border border-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark-text truncate">{item.title}</p>
                      {context && (
                        <p className="text-xs text-muted-text truncate mt-0.5">{context}</p>
                      )}
                      <p className="text-xs text-muted-text mt-0.5">
                        Trashed {timeAgo(item.deleted_at)} · <span className="text-yellow-500">{expiresIn(item.deleted_at)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={busy || isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-teal-primary/50 text-teal-primary hover:bg-teal-light/20 transition-colors disabled:opacity-50"
                      >
                        {busy ? '…' : 'Restore'}
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={busy || isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-text mt-8 text-center">
        Items in trash are permanently deleted after 7 days. Restore an item to put it back in its original location.
      </p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LocalDateTime from './LocalDateTime'
import { deleteGradeHistoryEntry } from '@/lib/grade-actions'

export type GradeHistoryEntry = {
  id: string
  grade: 'complete' | 'incomplete'
  graded_at: string
}

export default function GradeHistoryList({
  entries,
  courseId,
  canManage = false,
}: {
  entries: GradeHistoryEntry[]
  /** Course the submission belongs to, required to authorize a delete. */
  courseId?: string
  /** Instructors/admins/TAs can remove a stray entry; students only view. */
  canManage?: boolean
}) {
  const router = useRouter()
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const visible = entries.filter(e => !removedIds.has(e.id))
  if (visible.length === 0) return null

  // De-duplicate consecutive same-grade entries (e.g. double-click producing two incompletes)
  const deduped = visible.filter((entry, i) => i === visible.length - 1 || entry.grade !== visible[i + 1].grade)

  const incompleteCount = deduped.filter(e => e.grade === 'incomplete').length

  const handleDelete = async (entryId: string) => {
    if (deletingId) return
    if (!confirm(
      'Remove this entry? It will no longer count toward the weekly readiness score.'
    )) return
    setDeletingId(entryId)
    const result = await deleteGradeHistoryEntry(entryId, courseId)
    if (result.error) {
      console.error('Failed to delete grade history entry:', result.error)
      setDeletingId(null)
      return
    }
    setRemovedIds(prev => new Set([...prev, entryId]))
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Grade History</p>
        {incompleteCount > 0 && (
          <span className="status-revision-btn text-xs font-semibold px-2.5 py-1 rounded-full border">
            {incompleteCount} incomplete{incompleteCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {deduped.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              entry.grade === 'complete' ? 'status-complete-btn' : 'status-revision-btn'
            }`}>
              {entry.grade === 'complete' ? 'Complete ✓' : 'Incomplete'}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-text">
                <LocalDateTime iso={entry.graded_at} />
              </span>
              {canManage && entry.grade === 'incomplete' && (
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  title="Remove this entry from the weekly readiness count"
                  className="text-xs font-medium text-muted-text hover:text-red-600 hover:underline disabled:opacity-50 transition-colors"
                >
                  {deletingId === entry.id ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

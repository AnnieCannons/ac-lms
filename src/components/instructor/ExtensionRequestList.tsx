'use client'
import { useState } from 'react'
import { reviewExtensionRequest } from '@/lib/extension-actions'
import type { ExtensionRequest } from '@/lib/extension-actions'

const REASON_LABELS: Record<string, string> = {
  not_enough_time: 'Did not have enough time',
  bug: 'Has a bug they can\'t figure out',
  dont_understand: 'Doesn\'t understand the assignment',
  other: 'Other',
}

const PLAN_LABELS: Record<string, string> = {
  calendar: 'Make time in my calendar',
  ask_help: 'Ask for help',
  other: 'Other',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function RequestCard({
  req,
  courseId,
  onReviewed,
}: {
  req: ExtensionRequest
  courseId: string
  onReviewed: (id: string, status: 'approved' | 'denied') => void
}) {
  const [expanded, setExpanded] = useState(req.status === 'pending')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReview(status: 'approved' | 'denied') {
    setSubmitting(true)
    setError(null)
    const result = await reviewExtensionRequest(req.id, courseId, status, comment.trim() || null)
    setSubmitting(false)
    if (result.error) { setError(result.error); return }
    onReviewed(req.id, status)
  }

  const reasonLabel = REASON_LABELS[req.reason] ?? req.reason
  const planLabels = req.plan.map(p => PLAN_LABELS[p] ?? p)

  const statusColors = {
    pending: 'bg-amber-500/10 text-amber-700 border-amber-500/40',
    approved: 'bg-green-500/10 text-green-700 border-green-500/40',
    denied: 'bg-red-500/10 text-red-700 border-red-500/40',
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 hover:bg-background/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-dark-text">{req.student_name}</span>
            <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${statusColors[req.status]}`}>
              {req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Denied'}
            </span>
          </div>
          <p className="text-sm text-muted-text truncate">{req.assignment_title}</p>
          <p className="text-xs text-muted-text/60 mt-0.5">Submitted {formatDate(req.created_at)}</p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round"
          className={`shrink-0 mt-1 text-muted-text transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-dark-text">{reasonLabel}</p>
              {req.reason === 'other' && req.reason_other && (
                <p className="text-sm text-muted-text mt-0.5 italic">{req.reason_other}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Plan</p>
              <ul className="flex flex-col gap-0.5">
                {planLabels.map((label, i) => (
                  <li key={i} className="text-sm text-dark-text flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-primary shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
              {req.plan.includes('other') && req.plan_other && (
                <p className="text-sm text-muted-text mt-0.5 italic">{req.plan_other}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Requested due date</p>
            <p className="text-sm text-dark-text font-medium">{formatDateTime(req.requested_due_date)}</p>
          </div>

          {req.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Additional notes</p>
              <p className="text-sm text-dark-text">{req.notes}</p>
            </div>
          )}

          {/* Review form for pending requests */}
          {req.status === 'pending' && (
            <div className="border-t border-border pt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5 block">
                  Comment for student <span className="font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Leave a note for the student…"
                  rows={2}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleReview('approved')}
                  disabled={submitting}
                  className="flex-1 bg-teal-primary text-white text-sm font-semibold py-2 rounded-full hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReview('denied')}
                  disabled={submitting}
                  className="flex-1 border border-red-400 text-red-600 text-sm font-semibold py-2 rounded-full hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Saving…' : 'Deny'}
                </button>
              </div>
            </div>
          )}

          {/* Reviewed state */}
          {req.status !== 'pending' && req.instructor_comment && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Your comment</p>
              <p className="text-sm text-dark-text">{req.instructor_comment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExtensionRequestList({
  courseId,
  pending,
  reviewed,
}: {
  courseId: string
  pending: ExtensionRequest[]
  reviewed: ExtensionRequest[]
}) {
  const [pendingList, setPendingList] = useState(pending)
  const [reviewedList, setReviewedList] = useState(reviewed)

  function handleReviewed(id: string, status: 'approved' | 'denied') {
    const req = pendingList.find(r => r.id === id)
    if (!req) return
    setPendingList(prev => prev.filter(r => r.id !== id))
    setReviewedList(prev => [{ ...req, status }, ...prev])
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Pending */}
      <section>
        <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
          Pending review ({pendingList.length})
        </h2>
        {pendingList.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-muted-text text-center">
            No pending requests
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingList.map(req => (
              <RequestCard key={req.id} req={req} courseId={courseId} onReviewed={handleReviewed} />
            ))}
          </div>
        )}
      </section>

      {/* Reviewed */}
      {reviewedList.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">
            Reviewed ({reviewedList.length})
          </h2>
          <div className="flex flex-col gap-3">
            {reviewedList.map(req => (
              <RequestCard key={req.id} req={req} courseId={courseId} onReviewed={handleReviewed} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

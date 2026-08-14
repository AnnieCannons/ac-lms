'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { getSubmissionComments, type SubmissionCommentPreview } from '@/lib/grade-actions'
import type { AssignmentStat, StatsHistoryPoint } from '@/lib/student-stats-actions'
import MarkdownContent from '@/components/ui/MarkdownContent'
import LocalDateTime from '@/components/ui/LocalDateTime'
import Link from 'next/link'

export const MISSING_COLOR = '#dc2626'
export const NEEDS_REVISION_COLOR = '#f59e0b'

function formatWeekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TrendChart({ history }: { history: StatsHistoryPoint[] }) {
  if (history.length < 2) {
    return <p className="text-sm text-muted-text py-2">Trend appears after a couple weeks of data.</p>
  }

  const data = history.map(h => ({ week: formatWeekLabel(h.weekStart), missing: h.missing, needsRevision: h.needsRevision }))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: MISSING_COLOR }} />
          Missing
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: NEEDS_REVISION_COLOR }} />
          Needs Revision
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: 'currentColor' }}
            tickLine={false}
            axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
            className="text-muted-text"
          />
          <YAxis
            domain={[0, 'dataMax']}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            tickLine={false}
            axisLine={false}
            width={24}
            className="text-muted-text"
          />
          <Tooltip
            labelFormatter={(label) => `Week of ${label}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line
            type="linear"
            dataKey="missing"
            name="Missing"
            stroke={MISSING_COLOR}
            strokeWidth={2}
            dot={data.length <= 8 ? { r: 2, fill: MISSING_COLOR, strokeWidth: 0 } : false}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="needsRevision"
            name="Needs Revision"
            stroke={NEEDS_REVISION_COLOR}
            strokeWidth={2}
            dot={data.length <= 8 ? { r: 2, fill: NEEDS_REVISION_COLOR, strokeWidth: 0 } : false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ZoneBadge({ absences }: { absences: number }) {
  if (absences >= 23) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-200 text-red-900">Red zone</span>
  if (absences >= 12) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900">Yellow zone</span>
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Green zone</span>
}

export function StatCard({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all text-left ${
        active
          ? `${color} border-current shadow-sm`
          : 'bg-background border-border hover:border-muted-text'
      }`}
    >
      <span className={`text-2xl font-bold ${active ? '' : 'text-dark-text'}`}>{count}</span>
      <span className={`text-xs font-medium ${active ? '' : 'text-muted-text'}`}>{label}</span>
    </button>
  )
}

function CommentsPreview({ submissionId, courseId }: { submissionId: string; courseId: string }) {
  const [comments, setComments] = useState<SubmissionCommentPreview[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSubmissionComments(submissionId, courseId)
      .then(result => { if (!cancelled) setComments(result) })
      .catch(() => { if (!cancelled) setError('Could not load comments.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [submissionId, courseId])

  if (loading) return <p className="text-xs text-muted-text px-4 pb-3">Loading comments…</p>
  if (error) return <p className="text-xs text-red-600 px-4 pb-3">{error}</p>
  if (!comments || comments.length === 0) return <p className="text-xs text-muted-text italic px-4 pb-3">No comments.</p>

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {comments.map(c => (
        <div key={c.id} className="text-xs bg-background rounded-lg border border-border p-2.5">
          <p className="font-semibold text-dark-text">
            {c.author_name} <span className="font-normal text-muted-text">· {c.author_role}</span>
            <span className="font-normal text-muted-text"> · <LocalDateTime iso={c.created_at} /></span>
          </p>
          <div className="mt-0.5">
            <MarkdownContent content={c.content} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AssignmentRow({ a, courseId, studentId }: { a: AssignmentStat; courseId: string; studentId: string }) {
  const [showComments, setShowComments] = useState(false)

  return (
    <li className="bg-surface hover:bg-background transition-colors">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions/${studentId}?by=student`}
            className="text-sm font-medium text-teal-primary hover:underline truncate block"
          >
            {a.title}
          </Link>
          {a.module_title && (
            <span className="text-xs text-muted-text">{a.module_title}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {a.comment_count > 0 && (
            <button
              type="button"
              onClick={() => setShowComments(v => !v)}
              className="flex items-center gap-1 text-xs text-teal-primary hover:underline"
            >
              {a.comment_count} comment{a.comment_count === 1 ? '' : 's'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-3 h-3 transition-transform ${showComments ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          {a.due_date && (
            <span className="text-xs text-muted-text">
              Due {new Date(a.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      {showComments && a.submission_id && (
        <CommentsPreview submissionId={a.submission_id} courseId={courseId} />
      )}
    </li>
  )
}

export function AssignmentList({
  assignments,
  courseId,
  studentId,
  label,
}: {
  assignments: AssignmentStat[]
  courseId: string
  studentId: string
  label: string
}) {
  if (assignments.length === 0) {
    return <p className="text-sm text-muted-text py-2">No {label.toLowerCase()} assignments.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
      {assignments.map(a => (
        <AssignmentRow key={a.id} a={a} courseId={courseId} studentId={studentId} />
      ))}
    </ul>
  )
}

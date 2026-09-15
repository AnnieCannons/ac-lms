import Link from 'next/link'
import UserAvatar from '@/components/ui/UserAvatar'
import { ReadinessZoneBadge, READINESS_COLOR } from '@/components/ui/ReadinessWidgets'
import type { CourseReadinessSummaryRow } from '@/lib/readiness-actions'

function formatBlocksMissed(row: CourseReadinessSummaryRow): string {
  const { latest } = row
  if (!latest || latest.blocksTotal == null || latest.blocksTotal === 0) return '—'
  return `${latest.blocksMissed ?? 0} of ${latest.blocksTotal}`
}

function formatWeekOf(weekStart: string | undefined): string {
  if (!weekStart) return '—'
  return `Week of ${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export default function ClassReadinessView({
  courseId,
  students,
}: {
  courseId: string
  students: CourseReadinessSummaryRow[]
}) {
  if (students.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text">
        No students enrolled in this course.
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface border-b border-border">
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Score</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Zone</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Missing</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Needs Revision</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">Attendance</th>
            <th className="text-left px-4 py-3 font-semibold text-muted-text">As of</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {students.map(row => (
            <tr key={row.studentId} className="bg-background">
              <td className="px-4 py-3 font-medium text-dark-text">
                <Link
                  href={`/instructor/courses/${courseId}/roster/${row.studentId}`}
                  className="flex items-center gap-2 hover:text-teal-primary hover:underline"
                >
                  <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                  {row.name || '—'}
                </Link>
              </td>
              <td className="px-4 py-3">
                {row.latest?.score != null ? (
                  <span className="font-bold" style={{ color: READINESS_COLOR }}>
                    {row.latest.score.toFixed(1)}<span className="text-xs text-muted-text font-normal">/5</span>
                  </span>
                ) : (
                  <span className="text-muted-text">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <ReadinessZoneBadge zone={row.latest?.zone ?? null} />
              </td>
              <td className="px-4 py-3 text-dark-text">{row.latest?.missing ?? '—'}</td>
              <td className="px-4 py-3 text-dark-text">{row.latest?.needsRevision ?? '—'}</td>
              <td className="px-4 py-3 text-dark-text">{formatBlocksMissed(row)}</td>
              <td className="px-4 py-3 text-muted-text text-xs">{formatWeekOf(row.latest?.weekStart)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

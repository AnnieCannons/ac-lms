import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import UserAvatar from '@/components/ui/UserAvatar'
import { ReadinessZoneBadge, READINESS_COLOR } from '@/components/ui/ReadinessWidgets'
import type { CourseReadinessRow, CourseReadinessWeek } from '@/lib/readiness-actions'
import type { Zone } from '@/lib/readiness'

function formatBlocksMissed(row: CourseReadinessRow): string {
  const { week } = row
  if (!week || week.blocksTotal == null || week.blocksTotal === 0) return '—'
  return `${week.blocksMissed ?? 0} of ${week.blocksTotal}`
}

function formatWeekOf(weekStart: string): string {
  return `Week of ${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatAvg(value: number | null): string {
  return value == null ? '—' : value.toFixed(1)
}

function WeekArrow({ courseId, week, direction }: { courseId: string; week: string | undefined; direction: 'prev' | 'next' }) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  const label = direction === 'prev' ? 'Previous week' : 'Next week'
  const className = 'p-1.5 rounded-lg border border-border'
  if (!week) {
    return (
      <span aria-disabled="true" aria-label={label} className={`${className} text-border cursor-not-allowed`}>
        <Icon size={18} />
      </span>
    )
  }
  return (
    <Link
      href={`/instructor/courses/${courseId}/readiness?week=${week}`}
      aria-label={label}
      className={`${className} text-dark-text hover:bg-surface hover:text-teal-primary`}
    >
      <Icon size={18} />
    </Link>
  )
}

const ZONE_CARDS: { zone: Zone; label: string; className: string }[] = [
  { zone: 'green', label: 'Apprenticeship Ready', className: 'bg-green-100 text-green-800' },
  { zone: 'yellow', label: 'Needs Improvement', className: 'bg-yellow-200 text-yellow-900' },
  { zone: 'red', label: 'Needs Swift Improvement', className: 'bg-red-200 text-red-900' },
]

function StatCard({ label, value, detail, className = 'bg-surface text-dark-text' }: { label: string; value: string; detail?: string; className?: string }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${className}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {detail && <div className="text-xs mt-0.5 opacity-80">{detail}</div>}
    </div>
  )
}

function deltaDetail(current: number | null, previous: number | null | undefined, digits: number): string | undefined {
  if (current == null || previous == null) return undefined
  const delta = current - previous
  if (Math.abs(delta) < 10 ** -digits / 2) return 'No change from last week'
  return `${delta > 0 ? '+' : ''}${delta.toFixed(digits)} from last week`
}

export default function ClassReadinessView({
  courseId,
  readiness,
}: {
  courseId: string
  readiness: CourseReadinessWeek
}) {
  const { weeks, weekStart, weekNumber, rows, averages, previousAverages } = readiness

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text">
        No students enrolled in this course.
      </div>
    )
  }

  if (!weekStart) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text">
        No weekly readiness scores yet. Scores are calculated every Monday for the previous week.
      </div>
    )
  }

  const index = weeks.indexOf(weekStart)
  const noDataCount = rows.filter(r => !r.week).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <WeekArrow courseId={courseId} week={weeks[index - 1]} direction="prev" />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-dark-text">
            {weekNumber != null && weekNumber > 0 ? `Week ${weekNumber}` : formatWeekOf(weekStart)}
          </div>
          {weekNumber != null && weekNumber > 0 && <div className="text-xs text-muted-text">{formatWeekOf(weekStart)}</div>}
        </div>
        <WeekArrow courseId={courseId} week={weeks[index + 1]} direction="next" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Class average score"
          value={averages.score != null ? `${averages.score.toFixed(1)}/5` : '—'}
          detail={deltaDetail(averages.score, previousAverages?.score, 1)}
        />
        {ZONE_CARDS.map(({ zone, label, className }) => (
          <StatCard
            key={zone}
            label={label}
            value={String(averages.zoneCounts[zone])}
            detail={deltaDetail(averages.zoneCounts[zone], previousAverages?.zoneCounts[zone], 0)}
            className={className}
          />
        ))}
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Score</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Missing</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Needs Revision</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Blocks Missed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="bg-surface/60 border-b-2 border-border">
              <td className="px-4 py-3 font-semibold text-dark-text">
                Class average
                <div className="text-xs font-normal text-muted-text">{averages.studentCount} student{averages.studentCount === 1 ? '' : 's'}</div>
              </td>
              <td className="px-4 py-3 font-semibold" style={{ color: READINESS_COLOR }}>
                {formatAvg(averages.score)}<span className="text-xs text-muted-text font-normal">/5</span>
              </td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 font-semibold text-dark-text">{formatAvg(averages.missing)}</td>
              <td className="px-4 py-3 font-semibold text-dark-text">{formatAvg(averages.needsRevision)}</td>
              <td className="px-4 py-3 font-semibold text-dark-text">
                {averages.blocksMissed != null ? `${formatAvg(averages.blocksMissed)} of ${Math.round(averages.blocksTotal ?? 0)}` : '—'}
              </td>
            </tr>
            {rows.map(row => (
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
                  {row.week?.score != null ? (
                    <span className="font-bold" style={{ color: READINESS_COLOR }}>
                      {row.week.score.toFixed(1)}<span className="text-xs text-muted-text font-normal">/5</span>
                    </span>
                  ) : (
                    <span className="text-muted-text">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ReadinessZoneBadge zone={row.week?.zone ?? null} />
                </td>
                <td className="px-4 py-3 text-dark-text">{row.week?.missing ?? '—'}</td>
                <td className="px-4 py-3 text-dark-text">{row.week?.needsRevision ?? '—'}</td>
                <td className="px-4 py-3 text-dark-text">{formatBlocksMissed(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-text">
        Averages leave out students with no score this week
        {noDataCount > 0 ? ` (${noDataCount} this week)` : ''}; blocks missed also leaves out students with no Airtable attendance match. Missing is how many assignments were outstanding when the week was scored, not new ones that week.
      </p>
    </div>
  )
}

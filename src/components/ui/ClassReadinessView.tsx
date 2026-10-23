import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { READINESS_COLOR } from '@/components/ui/ReadinessWidgets'
import ClassReadinessRow from '@/components/ui/ClassReadinessRow'
import type { CourseReadinessWeek } from '@/lib/readiness-actions'
import type { PreviewWeek } from '@/lib/readiness-score'
import { LIVE_WEEK, type Zone } from '@/lib/readiness-breakdown'
import { formatDueDate } from '@/lib/date-utils'

function formatWeekOf(weekStart: string): string {
  return `Week of ${new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatAvg(value: number | null): string {
  return value == null ? '—' : value.toFixed(1)
}

function weekHref(courseId: string, week: string): string {
  return `/instructor/courses/${courseId}/readiness?week=${week}`
}

/** Link into the live "this week so far" view. */
function LiveWeekLink({ courseId }: { courseId: string }) {
  return (
    <Link
      href={weekHref(courseId, LIVE_WEEK)}
      className="text-sm font-medium text-teal-primary border border-teal-primary/40 px-3 py-1.5 rounded-lg hover:bg-teal-light transition-colors whitespace-nowrap"
    >
      This week so far →
    </Link>
  )
}

function LiveWeekBanner({ liveWeek }: { liveWeek: PreviewWeek }) {
  return (
    <div className="rounded-lg border border-teal-primary/40 bg-teal-light px-4 py-3 text-sm text-dark-text">
      <span className="font-semibold">Live preview — not final.</span>{' '}
      Worked out just now from attendance through {formatDueDate(liveWeek.end)}, missing work as of right now, and returns for revision through {formatDueDate(liveWeek.returnsEnd)}.
      The real score is recorded on the morning of {formatDueDate(liveWeek.scoredOn)}; turning in missing work before then raises it.
      Nothing here is saved or sent to anyone. Click the arrow next to a name to see what&apos;s costing them points.
    </div>
  )
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
      href={weekHref(courseId, week)}
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
  const { weeks, weekStart, weekNumber, rows, averages, previousAverages, liveWeek, isLive } = readiness
  const liveAvailable = !!liveWeek && !liveWeek.onBreak && !liveWeek.notInSession

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text">
        No students enrolled in this course.
      </div>
    )
  }

  if (!weekStart) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text space-y-4">
        <p>No weekly readiness scores yet. Scores are calculated every Monday for the previous week.</p>
        {liveAvailable && <div><LiveWeekLink courseId={courseId} /></div>}
      </div>
    )
  }

  // The live week sits after the last scored week in the arrow order.
  const index = weeks.indexOf(weekStart)
  const prevWeek = isLive ? weeks.filter(w => w < weekStart).at(-1) : weeks[index - 1]
  const nextWeek = isLive
    ? undefined
    : weeks[index + 1] ?? (liveAvailable && liveWeek!.start > weekStart ? LIVE_WEEK : undefined)
  const noDataCount = rows.filter(r => !r.week && !r.isTestAccount).length
  const weekLabel = weekNumber != null && weekNumber > 0 ? `Week ${weekNumber}` : formatWeekOf(weekStart)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <WeekArrow courseId={courseId} week={prevWeek} direction="prev" />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-dark-text flex items-center gap-2">
            {weekLabel}{isLive && ' — so far'}
            {isLive && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-teal-light text-teal-primary">Live</span>}
          </div>
          {weekNumber != null && weekNumber > 0 && <div className="text-xs text-muted-text">{formatWeekOf(weekStart)}</div>}
        </div>
        <WeekArrow courseId={courseId} week={nextWeek} direction="next" />
        {!isLive && liveAvailable && nextWeek !== LIVE_WEEK && (
          <div className="ml-auto"><LiveWeekLink courseId={courseId} /></div>
        )}
      </div>

      {isLive && liveWeek && (liveWeek.onBreak || liveWeek.notInSession) ? (
        <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text">
          {liveWeek.onBreak
            ? 'This is a break week, so it won’t be scored.'
            : 'This course isn’t in session this week, so there’s nothing to preview.'}
        </div>
      ) : (
      <>
      {isLive && liveWeek && <LiveWeekBanner liveWeek={liveWeek} />}

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
              <ClassReadinessRow key={row.studentId} courseId={courseId} row={row} liveWeek={isLive ? liveWeek : null} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-text">
        Averages leave out students with no score this week
        {noDataCount > 0 ? ` (${noDataCount} this week)` : ''}; blocks missed also leaves out students with no Airtable attendance match.{' '}
        {isLive
          ? 'Missing is how many assignments are outstanding right now. The change from last week compares against the last scored week.'
          : 'Missing is how many assignments were outstanding when the week was scored, not new ones that week.'}
      </p>
      </>
      )}
    </div>
  )
}

import type { FollowUpStatus, ReportRow } from '@/lib/cutting-edge'

const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = {
  thanked: 'Thanked',
  missed: 'Didn’t make it',
  pending: 'Not yet',
  no_follow_up: 'No follow-up',
  not_required: '—',
}

/** Read-only per-student view of an event's RSVPs and completions. */
export default function EventStudentTable({
  rows,
  courseNames,
}: {
  rows: ReportRow[]
  courseNames: Record<string, string>
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-text">No students in this talk&apos;s audience.</p>

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-muted-text text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">Student</th>
            <th className="text-left px-2 py-2 font-semibold">Class</th>
            <th className="px-2 py-2 font-semibold">RSVP</th>
            <th className="px-2 py-2 font-semibold">Question</th>
            <th className="px-2 py-2 font-semibold">Thank-you</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={`border-t border-border ${r.followUp === 'no_follow_up' ? 'bg-red-600/5' : ''}`}>
              <td className="px-4 py-2 text-dark-text">
                {r.name}
                {!r.inAudience && <span className="ml-2 text-[11px] text-muted-text">(no longer in audience)</span>}
              </td>
              <td className="px-2 py-2 text-muted-text text-xs">{r.courseId ? courseNames[r.courseId] ?? '' : '—'}</td>
              <td className="px-2 py-2 text-center">
                {r.response === 'yes' ? 'Yes' : r.response === 'no' ? 'No' : <span className="text-muted-text">No reply</span>}
              </td>
              <td className="px-2 py-2 text-center">{r.questionDone ? '✓' : ''}</td>
              <td className={`px-2 py-2 text-center ${r.followUp === 'no_follow_up' ? 'text-red-600 font-semibold' : ''}`}>
                {FOLLOW_UP_LABEL[r.followUp]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

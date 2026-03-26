export type GradeHistoryEntry = {
  id: string
  grade: 'complete' | 'incomplete'
  graded_at: string
}

export default function GradeHistoryList({ entries }: { entries: GradeHistoryEntry[] }) {
  if (entries.length === 0) return null

  const incompleteCount = entries.filter(e => e.grade === 'incomplete').length

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
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              entry.grade === 'complete' ? 'status-complete-btn' : 'status-revision-btn'
            }`}>
              {entry.grade === 'complete' ? 'Complete ✓' : 'Incomplete'}
            </span>
            <span className="text-xs text-muted-text">
              {new Date(entry.graded_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

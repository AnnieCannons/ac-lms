export interface StageHistoryEntry {
  id: string
  stage: string
  changed_at: string
  users: { name: string } | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function StageHistory({ history }: { history: StageHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-text italic">No previous stages yet.</p>
  }

  // history arrives oldest-first; show most recent at the top
  const entries = [...history].reverse()

  return (
    <div className="flex flex-col">
      {entries.map((entry, i) => {
        const label = entry.stage || 'Added to flow'

        return (
          <div key={entry.id} className="flex items-start gap-3">
            {/* dot + connector */}
            <div className="flex flex-col items-center shrink-0 pt-1">
              <div className="w-2.5 h-2.5 rounded-full border-2 bg-background border-border" />
              {i < entries.length - 1 && (
                <div className="w-px flex-1 min-h-[20px] bg-border mt-0.5" />
              )}
            </div>

            {/* content */}
            <div className="pb-3 flex flex-col gap-0.5">
              <span className="text-sm text-dark-text">{label}</span>
              <span className="text-xs text-muted-text">
                {formatDate(entry.changed_at)}
                {entry.users?.name && ` · ${entry.users.name}`}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
    return <p className="text-xs text-muted-text italic">Stage changes will be tracked going forward.</p>
  }

  return (
    <div className="flex flex-col">
      {history.map((entry, i) => {
        const isCurrent = i === history.length - 1
        const isFirst = i === 0
        const label = entry.stage || (isFirst ? 'Added to flow' : '—')

        return (
          <div key={entry.id} className="flex items-start gap-3">
            {/* dot + connector */}
            <div className="flex flex-col items-center shrink-0 pt-1">
              <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                isCurrent
                  ? 'bg-teal-primary border-teal-primary'
                  : 'bg-background border-border'
              }`} />
              {i < history.length - 1 && (
                <div className="w-px flex-1 min-h-[20px] bg-border mt-0.5" />
              )}
            </div>

            {/* content */}
            <div className={`pb-3 flex flex-col gap-0.5 ${isCurrent ? '' : 'opacity-70'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${isCurrent ? 'font-semibold text-dark-text' : 'text-dark-text'}`}>
                  {label}
                </span>
                {isCurrent && (
                  <span className="text-xs font-medium text-teal-primary bg-teal-primary/10 rounded-full px-2 py-0.5">
                    current
                  </span>
                )}
              </div>
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

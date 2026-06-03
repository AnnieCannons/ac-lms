interface RatingEntry {
  service_category: string
  avg: number
  count: number
}

interface Props {
  ratings: RatingEntry[]
  /** If provided, shows only the rating for this category. Otherwise shows overall avg. */
  category?: string
}

export default function PartnerRatingBadge({ ratings, category }: Props) {
  if (!ratings || ratings.length === 0) return null

  let display: { avg: number; count: number; label?: string } | null = null

  if (category) {
    const match = ratings.find(r => r.service_category === category)
    if (!match) return null
    display = { avg: match.avg, count: match.count, label: match.service_category }
  } else {
    // Compute overall avg across all categories (weighted by count)
    const totalCount = ratings.reduce((sum, r) => sum + r.count, 0)
    if (totalCount === 0) return null
    const weightedSum = ratings.reduce((sum, r) => sum + r.avg * r.count, 0)
    display = { avg: weightedSum / totalCount, count: totalCount }
  }

  if (!display) return null

  const rounded = Math.round(display.avg)
  const formatted = display.avg.toFixed(1)

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1">
      <span className="flex gap-0.5" aria-label={`${formatted} out of 5`}>
        {[1, 2, 3, 4, 5].map(n => (
          <span
            key={n}
            className={`text-sm leading-none ${
              n <= rounded ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
            }`}
          >
            ★
          </span>
        ))}
      </span>
      <span className="text-sm font-semibold text-dark-text">{formatted}</span>
      <span className="text-xs text-muted-text">
        ({display.count} {display.count === 1 ? 'rating' : 'ratings'})
      </span>
      {display.label && (
        <span className="text-xs text-muted-text border-l border-border pl-1.5 ml-0.5">
          {display.label}
        </span>
      )}
    </div>
  )
}

import { SEED_ACTIVITY_LOG } from '@/lib/flashcards/seed'

function getIntensity(count: number): string {
  if (count === 0) return 'bg-border/40'
  if (count <= 5) return 'bg-teal-primary/30'
  if (count <= 10) return 'bg-teal-primary/55'
  if (count <= 15) return 'bg-teal-primary/80'
  return 'bg-teal-primary'
}

export default function ActivityGrid() {
  const activityMap = new Map(
    SEED_ACTIVITY_LOG.map(entry => [entry.date, entry.cards_studied_count])
  )

  const today = new Date('2026-06-05')
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 90)

  const days: { date: string; count: number }[] = []
  const cursor = new Date(startDate)
  while (cursor <= today) {
    const dateStr = cursor.toISOString().split('T')[0]
    days.push({ date: dateStr, count: activityMap.get(dateStr) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  const weeks: { date: string; count: number }[][] = []
  let currentWeek: { date: string; count: number }[] = []
  const firstDayOffset = new Date(days[0].date).getDay()
  for (let i = 0; i < firstDayOffset; i++) currentWeek.push({ date: '', count: 0 })
  for (const day of days) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  const totalStudied = SEED_ACTIVITY_LOG.reduce((sum, e) => sum + e.cards_studied_count, 0)

  return (
    <section aria-label="Study activity">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted-text uppercase tracking-widest">Activity</h2>
        <span className="text-xs text-muted-text">{totalStudied} cards studied in the last 90 days</span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day, di) =>
              day.date ? (
                <div
                  key={day.date}
                  className={`w-3 h-3 rounded-sm ${getIntensity(day.count)}`}
                  title={day.count > 0 ? `${day.date}: ${day.count} cards` : day.date}
                  role="img"
                  aria-label={day.count > 0 ? `${day.date}: ${day.count} cards studied` : `${day.date}: no cards studied`}
                />
              ) : (
                <div key={`empty-${wi}-${di}`} className="w-3 h-3" />
              )
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-xs text-muted-text">Less</span>
        {['bg-border/40', 'bg-teal-primary/30', 'bg-teal-primary/55', 'bg-teal-primary/80', 'bg-teal-primary'].map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} aria-hidden="true" />
        ))}
        <span className="text-xs text-muted-text">More</span>
      </div>
    </section>
  )
}

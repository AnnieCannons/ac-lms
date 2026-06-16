import { SEED_ACTIVITY_LOG } from '@/lib/flashcards/seed'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getIntensity(count: number, future: boolean): string {
  if (future) return 'bg-border/20'
  if (count === 0) return 'bg-border/40'
  if (count <= 5) return 'bg-teal-primary/30'
  if (count <= 10) return 'bg-teal-primary/55'
  if (count <= 15) return 'bg-teal-primary/80'
  return 'bg-teal-primary'
}

type Day = { date: string; count: number; future: boolean }

export default function ActivityGrid() {
  const activityMap = new Map(
    SEED_ACTIVITY_LOG.map(entry => [entry.date, entry.cards_studied_count])
  )

  const today = new Date('2026-06-05')
  const year = today.getFullYear()
  const startDate = new Date(year, 0, 1)  // Jan 1
  const endDate = new Date(year, 11, 31)  // Dec 31

  const days: Day[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().split('T')[0]
    days.push({
      date: dateStr,
      count: activityMap.get(dateStr) ?? 0,
      future: cursor > today,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  // Build weeks (Sun–Sat), padding first week
  const weeks: (Day | null)[][] = []
  let currentWeek: (Day | null)[] = []
  const firstDayOffset = new Date(days[0].date).getDay()
  for (let i = 0; i < firstDayOffset; i++) currentWeek.push(null)
  for (const day of days) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek)

  // Month label at the first week of each month
  const monthLabels: Map<number, string> = new Map()
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null) as Day | undefined
    if (!firstReal) return
    const month = new Date(firstReal.date).getMonth()
    if (month !== lastMonth) {
      monthLabels.set(wi, MONTH_LABELS[month])
      lastMonth = month
    }
  })

  const totalStudied = SEED_ACTIVITY_LOG.reduce((sum, e) => sum + e.cards_studied_count, 0)
  const shownDays = [1, 3, 5] // Mon, Wed, Fri

  return (
    <section aria-label="Study activity">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted-text uppercase tracking-widest">Activity</h2>
        <span className="text-xs text-muted-text">{totalStudied} cards studied in {year}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 pt-5 shrink-0">
          {DAY_LABELS.map((label, i) => (
            <div key={label} className="h-3 flex items-center">
              {shownDays.includes(i)
                ? <span className="text-[10px] text-muted-text w-6 leading-none">{label}</span>
                : <span className="w-6" />
              }
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex flex-col">
          {/* Month labels row */}
          <div className="flex gap-1 mb-1 h-4">
            {weeks.map((_, wi) => (
              <div key={wi} className="w-3 shrink-0">
                {monthLabels.has(wi) && (
                  <span className="text-[10px] text-muted-text whitespace-nowrap">{monthLabels.get(wi)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Squares */}
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1 shrink-0">
                {week.map((day, di) =>
                  day ? (
                    <div
                      key={day.date}
                      className={`w-3 h-3 rounded-sm ${getIntensity(day.count, day.future)}`}
                      title={day.future ? day.date : day.count > 0 ? `${day.date}: ${day.count} cards` : day.date}
                      role="img"
                      aria-label={
                        day.future
                          ? `${day.date}: future`
                          : day.count > 0
                          ? `${day.date}: ${day.count} cards studied`
                          : `${day.date}: no cards studied`
                      }
                    />
                  ) : (
                    <div key={`pad-${wi}-${di}`} className="w-3 h-3" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
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

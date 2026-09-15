'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CalendarPopover from './CalendarPopover'

type Cohort   = { id: string; name: string; start_date: string; end_date: string; order: number }
type Break    = { id: string; label: string; start_date: string; end_date: string; paid_only?: boolean | null }
type Holiday  = { id: string; label: string; date_display: string; date: string; end_date?: string | null; year: number }

type DayKind = 'session' | 'break' | 'holiday'
const KIND_PRIORITY: Record<DayKind, number> = { session: 0, break: 1, holiday: 2 }
const DAY_BG: Record<DayKind, string> = {
  session: 'bg-teal-primary text-white',
  break:   'bg-amber-500 text-white',
  holiday: 'bg-purple-primary text-white dark:text-purple-950',
}
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOW_LETTERS = ['S','M','T','W','T','F','S']
const WEEKEND_COL = new Set([0, 6])

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type DayInfo = { kind: DayKind; label: string }

function buildDayMap(cohorts: Cohort[], breaks: Break[], holidays: Holiday[]) {
  const map = new Map<string, DayInfo>()
  const apply = (kind: DayKind, label: string, start: string, end: string) => {
    if (!start || !end) return
    const cur = new Date(start + 'T00:00:00')
    const endD = new Date(end + 'T00:00:00')
    while (cur <= endD) {
      const key = dateKey(cur)
      const existing = map.get(key)
      if (!existing || KIND_PRIORITY[kind] > KIND_PRIORITY[existing.kind]) map.set(key, { kind, label })
      cur.setDate(cur.getDate() + 1)
    }
  }
  cohorts.forEach(c => apply('session', c.name, c.start_date, c.end_date))
  breaks.forEach(b => apply('break', b.label, b.start_date, b.end_date))
  holidays.forEach(h => apply('holiday', h.label, h.date, h.end_date ?? h.date))
  return map
}

function MonthMini({ year, month, dayMap }: { year: number; month: number; dayMap: Map<string, DayInfo> }) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = firstDay.getDay()
  const cells: (number | null)[] = [...Array(startDow).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <p className="text-xs font-semibold text-dark-text text-center mb-1.5">{MONTHS_SHORT[month]}</p>
      <div className="grid grid-cols-7 mb-0.5">
        {DOW_LETTERS.map((d, col) => (
          <span key={col} className={`text-center text-[10px] font-medium ${WEEKEND_COL.has(col) ? 'text-amber-700 dark:text-amber-400' : 'text-muted-text'}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const col = i % 7
          const info = dayMap.get(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
          const cls = info ? DAY_BG[info.kind] : (WEEKEND_COL.has(col) ? 'text-amber-700 dark:text-amber-400' : 'text-dark-text')
          const isHoliday = info?.kind === 'holiday'
          return (
            <div key={i} className={isHoliday ? 'relative group/day' : undefined}>
              <div className={`text-center text-[10px] py-1 rounded font-medium ${cls} ${isHoliday ? 'cursor-default' : ''}`}>
                {day}
              </div>
              {isHoliday && (
                <div className="pointer-events-none absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/day:block whitespace-nowrap rounded-md bg-gray-900/95 text-white text-[11px] font-medium px-2 py-1 shadow-lg">
                  {info.label}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function YearlyCalendarGrid({
  year, onYearChange, cohorts, breaks, holidays, hideCohorts,
}: {
  year: number
  onYearChange: (y: number) => void
  cohorts: Cohort[]
  breaks: Break[]
  holidays: Holiday[]
  hideCohorts?: boolean
}) {
  const dayMap = useMemo(
    () => buildDayMap(hideCohorts ? [] : cohorts, breaks, holidays),
    [cohorts, breaks, holidays, hideCohorts]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onYearChange(year - 1)}
            aria-label="Previous year"
            className="px-2 py-1 text-sm border border-border rounded-lg hover:border-teal-primary text-muted-text hover:text-teal-primary transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-bold text-dark-text w-14 text-center">{year}</span>
          <button
            onClick={() => onYearChange(year + 1)}
            aria-label="Next year"
            className="px-2 py-1 text-sm border border-border rounded-lg hover:border-teal-primary text-muted-text hover:text-teal-primary transition-colors"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-text flex-wrap">
          {!hideCohorts && (
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-primary" /> In session</span>
          )}
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Break</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-primary" /> Holiday</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-5 rounded-xl border border-border p-4 bg-surface">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthMini key={m} year={year} month={m} dayMap={dayMap} />
        ))}
      </div>
    </div>
  )
}

function formatDate(d: string) {
  if (!d) return '—'
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

export default function YearlyScheduleSection({ instructorEditHref, hideCohorts, paidOnly }: { instructorEditHref?: string; hideCohorts?: boolean; paidOnly?: boolean } = {}) {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [breaks, setBreaks] = useState<Break[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(() => new Date().getFullYear())

  useEffect(() => {
    const supabase = createClient()
    const breaksQuery = paidOnly
      ? supabase.from('calendar_breaks').select('*').eq('paid_only', true).order('start_date', { ascending: true })
      : supabase.from('calendar_breaks').select('*').order('start_date', { ascending: true })
    Promise.all([
      supabase.from('calendar_cohorts').select('*').order('start_date', { ascending: true }),
      breaksQuery,
    ]).then(([{ data: c }, { data: rawBreaks }]) => {
      setCohorts(c ?? [])
      setBreaks(rawBreaks ?? [])
      setLoading(false)
    })
  }, [paidOnly])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('calendar_holidays').select('*').eq('year', year).order('date', { ascending: true })
      .then(({ data }) => setHolidays(data ?? []))
  }, [year])

  if (loading) return <p className="text-sm text-muted-text">Loading schedule…</p>
  if (!hideCohorts && cohorts.length === 0) return <p className="text-sm text-muted-text italic">No schedule data yet.</p>
  if (hideCohorts && holidays.length === 0 && breaks.length === 0) return <p className="text-sm text-muted-text italic">No holidays or breaks added yet.</p>

  const holidayHighlights = holidays.map(h => ({ start: h.date, end: h.end_date ?? undefined, color: 'purple' as const, label: h.label }))
  const breaksThisYear = breaks.filter(b =>
    (paidOnly || !b.paid_only) &&
    (new Date(b.start_date).getFullYear() === year || new Date(b.end_date).getFullYear() === year)
  )

  return (
    <div className="flex flex-col gap-8">
      {/* Color-coded year calendar */}
      <YearlyCalendarGrid year={year} onYearChange={setYear} cohorts={cohorts} breaks={breaks} holidays={holidays} hideCohorts={hideCohorts} />

      {/* Holidays */}
      {holidays.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p role="heading" aria-level={2} className="text-sm font-extrabold text-dark-text uppercase tracking-widest m-0">
              {year} Holidays
            </p>
            <CalendarPopover
              label="All Holidays"
              initialDate={holidays[0].date}
              highlights={holidayHighlights}
              editHref={instructorEditHref}
            />
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            {holidays.map((h, i) => (
              <div key={h.id} className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 ${i % 2 === 0 ? 'bg-surface' : 'bg-background'}`}>
                <span className="text-sm font-medium text-dark-text">{h.label}</span>
                <span className="text-sm text-muted-text">{h.date_display}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breaks */}
      {breaksThisYear.length > 0 && (
        <div>
          <p role="heading" aria-level={2} className="text-sm font-extrabold text-dark-text uppercase tracking-widest mb-3 m-0">
            Breaks — {year}
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            {breaksThisYear.map((b, i) => (
              <div key={b.id} className={`flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 ${i % 2 === 0 ? 'bg-surface' : 'bg-background'}`}>
                <span className="text-sm font-medium text-dark-text">{b.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-text">{formatDate(b.start_date)} – {formatDate(b.end_date)}</span>
                  <CalendarPopover
                    label={b.label}
                    initialDate={b.start_date}
                    highlights={[{ start: b.start_date, end: b.end_date, color: 'amber', label: b.label }]}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

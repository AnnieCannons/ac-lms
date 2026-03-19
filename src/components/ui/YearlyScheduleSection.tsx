'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CalendarPopover from './CalendarPopover'

type Cohort   = { id: string; name: string; start_date: string; end_date: string; order: number }
type Break    = { id: string; label: string; start_date: string; end_date: string }
type Holiday  = { id: string; label: string; date_display: string; date: string; end_date?: string | null; year: number }

type TimelineItem =
  | { kind: 'cohort'; name: string; start: string; end: string; isCurrent: boolean }
  | { kind: 'break';  label: string; start: string; end: string }

function formatDate(d: string) {
  if (!d) return '—'
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function buildTimeline(cohorts: Cohort[], breaks: Break[]): TimelineItem[] {
  const today = new Date()
  const sorted = [...cohorts].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

  let startIdx = sorted.findIndex(c => new Date(c.start_date) <= today && today <= new Date(c.end_date))
  if (startIdx === -1) startIdx = sorted.findIndex(c => new Date(c.start_date) > today)
  if (startIdx === -1) startIdx = Math.max(0, sorted.length - 3)

  const display = sorted.slice(startIdx, startIdx + 3)
  if (display.length === 0) return []

  const rangeStart = new Date(display[0].start_date)
  const rangeEnd   = new Date(display[display.length - 1].end_date)

  const relevantBreaks = breaks.filter(b =>
    new Date(b.start_date) <= rangeEnd && new Date(b.end_date) >= rangeStart
  )

  const items: TimelineItem[] = [
    ...display.map(c => ({
      kind: 'cohort' as const,
      name: c.name,
      start: c.start_date,
      end: c.end_date,
      isCurrent: new Date(c.start_date) <= today && today <= new Date(c.end_date),
    })),
    ...relevantBreaks.map(b => ({
      kind: 'break' as const,
      label: b.label,
      start: b.start_date,
      end: b.end_date,
    })),
  ]

  return items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

export default function YearlyScheduleSection({ instructorEditHref, hideCohorts, paidOnly }: { instructorEditHref?: string; hideCohorts?: boolean; paidOnly?: boolean } = {}) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [breaks, setBreaks] = useState<Break[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const currentYear = new Date().getFullYear()
    const breaksQuery = paidOnly
      ? supabase.from('calendar_breaks').select('*').eq('paid_only', true).order('start_date', { ascending: true })
      : supabase.from('calendar_breaks').select('*').order('start_date', { ascending: true })
    Promise.all([
      supabase.from('calendar_cohorts').select('*').order('start_date', { ascending: true }),
      breaksQuery,
      supabase.from('calendar_holidays').select('*').eq('year', currentYear).order('date', { ascending: true }),
    ]).then(([{ data: cohorts }, { data: rawBreaks }, { data: hols }]) => {
      setTimeline(buildTimeline(cohorts ?? [], rawBreaks ?? []))
      setBreaks(rawBreaks ?? [])
      setHolidays(hols ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-sm text-muted-text">Loading schedule…</p>
  if (!hideCohorts && timeline.length === 0) return <p className="text-sm text-muted-text italic">No schedule data yet.</p>
  if (hideCohorts && holidays.length === 0 && breaks.length === 0) return <p className="text-sm text-muted-text italic">No holidays or breaks added yet.</p>

  const holidayHighlights = holidays.map(h => ({ start: h.date, end: h.end_date ?? undefined, color: 'purple' as const, label: h.label }))

  return (
    <div className="flex flex-col gap-8">
      {/* Cohort / break timeline */}
      {!hideCohorts && <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_32px] bg-teal-light/60 border-b border-border">
          <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Period</div>
          <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Start</div>
          <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">End</div>
          <div />
        </div>
        {timeline.map((item, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_1fr_1fr_32px] items-center border-b border-border last:border-b-0 ${
              item.kind === 'cohort' ? 'bg-teal-light/30' : 'bg-amber-50'
            }`}
          >
            <div className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${
              item.kind === 'cohort' ? 'text-teal-primary' : 'text-amber-700'
            }`}>
              {item.kind === 'cohort' ? item.name : item.label}
              {item.kind === 'cohort' && item.isCurrent && (
                <span className="text-[10px] font-bold bg-teal-primary text-white px-1.5 py-0.5 rounded-full leading-none">
                  Current
                </span>
              )}
            </div>
            <div className="px-4 py-2.5 text-sm text-dark-text">{formatDate(item.start)}</div>
            <div className="px-4 py-2.5 text-sm text-dark-text">{formatDate(item.end)}</div>
            <div className="flex items-center justify-center pr-1">
              <CalendarPopover
                label={item.kind === 'cohort' ? item.name : item.label}
                initialDate={item.start}
                highlights={[{ start: item.start, end: item.end, color: item.kind === 'cohort' ? 'teal' : 'amber', label: item.kind === 'cohort' ? item.name : item.label }]}
              />
            </div>
          </div>
        ))}
      </div>}

      {/* Holidays */}
      {holidays.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-extrabold text-dark-text uppercase tracking-widest">
              {new Date().getFullYear()} Holidays
            </h3>
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

      {/* School Breaks */}
      {breaks.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold text-dark-text uppercase tracking-widest mb-3">
            School Breaks
          </h3>
          <div className="rounded-xl border border-border overflow-hidden">
            {breaks.map((b, i) => (
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

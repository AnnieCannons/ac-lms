'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Cohort = { id: string; name: string; start_date: string; end_date: string; order: number }
type Break  = { id: string; label: string; start_date: string; end_date: string }

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

  // Find starting index: current cohort, then next upcoming, then last 3
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

export default function YearlyScheduleSection() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('calendar_cohorts').select('*').order('start_date', { ascending: true }),
      supabase.from('calendar_breaks').select('*').order('start_date', { ascending: true }),
    ]).then(([{ data: cohorts }, { data: breaks }]) => {
      setTimeline(buildTimeline(cohorts ?? [], breaks ?? []))
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-sm text-muted-text">Loading schedule…</p>
  if (timeline.length === 0) return <p className="text-sm text-muted-text italic">No schedule data yet.</p>

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_1fr] bg-teal-light/60 border-b border-border">
        <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Period</div>
        <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Start</div>
        <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">End</div>
      </div>
      {timeline.map((item, i) => (
        <div
          key={i}
          className={`grid grid-cols-[1fr_1fr_1fr] border-b border-border last:border-b-0 ${
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
        </div>
      ))}
    </div>
  )
}

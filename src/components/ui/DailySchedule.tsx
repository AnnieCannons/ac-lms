'use client'
import { useState, useEffect } from 'react'

type RowType = 'class' | 'break' | 'lunch'

type ScheduleRow = {
  startMin: number // minutes from midnight Pacific
  endMin: number
  activity: string
  type: RowType
}

const SCHEDULE: ScheduleRow[] = [
  { startMin: 520, endMin: 525,  activity: 'Zoom room opens', type: 'class' },
  { startMin: 525, endMin: 532,  activity: 'Attendance taken at 8:45 AM Pacific. Students prepare their work environment.', type: 'class' },
  { startMin: 532, endMin: 540,  activity: 'Announcements', type: 'class' },
  { startMin: 540, endMin: 615,  activity: 'Block A', type: 'class' },
  { startMin: 615, endMin: 630,  activity: 'Break', type: 'break' },
  { startMin: 630, endMin: 690,  activity: 'Block B', type: 'class' },
  { startMin: 690, endMin: 720,  activity: 'Lunch', type: 'lunch' },
  { startMin: 720, endMin: 780,  activity: 'Block C', type: 'class' },
  { startMin: 780, endMin: 795,  activity: 'Break', type: 'break' },
  { startMin: 795, endMin: 855,  activity: 'Block D', type: 'class' },
]

const TIMEZONES = [
  { abbr: 'PT', label: 'Pacific',  offset: 0 },
  { abbr: 'MT', label: 'Mountain', offset: 1 },
  { abbr: 'CT', label: 'Central',  offset: 2 },
  { abbr: 'ET', label: 'Eastern',  offset: 3 },
]

const ROW_STYLES: Record<RowType, string> = {
  class:  'bg-white',
  break:  'bg-amber-50',
  lunch:  'bg-orange-50',
}

const ROW_ACTIVITY_STYLES: Record<RowType, string> = {
  class:  'text-dark-text',
  break:  'text-amber-700 font-medium',
  lunch:  'text-orange-700 font-medium',
}

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatRange(startMin: number, endMin: number, offsetHours: number): string {
  const off = offsetHours * 60
  return `${formatTime(startMin + off)} – ${formatTime(endMin + off)}`
}

function detectTz(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz.includes('Eastern'))  return 'ET'
    if (tz.includes('Central'))  return 'CT'
    if (tz.includes('Mountain')) return 'MT'
  } catch { /* ignore */ }
  return 'PT'
}

export default function DailySchedule() {
  const [selectedTz, setSelectedTz] = useState('PT')

  useEffect(() => {
    setSelectedTz(detectTz())
  }, [])

  const offset = TIMEZONES.find(t => t.abbr === selectedTz)?.offset ?? 0

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <h2 className="font-semibold text-dark-text">Daily Class Schedule</h2>

        {/* Timezone selector */}
        <div className="flex items-center gap-1 bg-background rounded-lg border border-border p-1">
          {TIMEZONES.map(tz => (
            <button
              key={tz.abbr}
              onClick={() => setSelectedTz(tz.abbr)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                selectedTz === tz.abbr
                  ? 'bg-teal-primary text-white'
                  : 'text-muted-text hover:text-dark-text'
              }`}
            >
              {tz.abbr}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_2fr] bg-teal-light/60 border-b border-border">
          <div className="px-4 py-2.5 text-xs font-bold text-dark-text uppercase tracking-wide">
            {TIMEZONES.find(t => t.abbr === selectedTz)?.label} Time
          </div>
          <div className="px-4 py-2.5 text-xs font-bold text-dark-text uppercase tracking-wide">
            Activity
          </div>
        </div>

        {/* Rows */}
        {SCHEDULE.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_2fr] border-b border-border last:border-b-0 ${ROW_STYLES[row.type]}`}
          >
            <div className="px-4 py-2.5 text-sm text-dark-text tabular-nums">
              {formatRange(row.startMin, row.endMin, offset)}
            </div>
            <div className={`px-4 py-2.5 text-sm ${ROW_ACTIVITY_STYLES[row.type]}`}>
              {row.activity}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className="w-3 h-3 rounded-sm bg-white border border-border inline-block" />
          Class time
        </span>
        <span className="flex items-center gap-1.5 text-xs text-amber-700">
          <span className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-200 inline-block" />
          Break
        </span>
        <span className="flex items-center gap-1.5 text-xs text-orange-700">
          <span className="w-3 h-3 rounded-sm bg-orange-50 border border-orange-200 inline-block" />
          Lunch
        </span>
      </div>
    </div>
  )
}

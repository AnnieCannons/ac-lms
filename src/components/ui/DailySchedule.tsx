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
  { startMin: 525, endMin: 532,  activity: 'Attendance taken at :45 on the dot. Students prepare their work environment.', type: 'class' },
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
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setSelectedTz(detectTz())
    setIsDark(document.documentElement.classList.contains('theme-dark'))

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('theme-dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const offset = TIMEZONES.find(t => t.abbr === selectedTz)?.offset ?? 0

  const rowBg: Record<RowType, string> = {
    class: isDark ? 'bg-surface' : 'bg-white',
    break: isDark ? 'bg-[#1e1a08]' : 'bg-amber-50',
    lunch: isDark ? 'bg-[#1e1205]' : 'bg-orange-50',
  }
  const rowActivity: Record<RowType, string> = {
    class: 'text-dark-text',
    break: isDark ? 'text-amber-400 font-medium' : 'text-amber-700 font-medium',
    lunch: isDark ? 'text-orange-400 font-medium' : 'text-orange-700 font-medium',
  }
  const legendClass  = isDark ? 'bg-surface border-border' : 'bg-white border-border'
  const legendBreak  = isDark ? 'bg-[#1e1a08] border-amber-900' : 'bg-amber-50 border-amber-200'
  const legendLunch  = isDark ? 'bg-[#1e1205] border-orange-900' : 'bg-orange-50 border-orange-200'
  const legendBreakText = isDark ? 'text-amber-400' : 'text-amber-700'
  const legendLunchText = isDark ? 'text-orange-400' : 'text-orange-700'

  return (
    <div>
      {/* Timezone selector */}
      <div className="flex justify-end mb-4">
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
            className={`grid grid-cols-[1fr_2fr] border-b border-border last:border-b-0 ${rowBg[row.type]}`}
          >
            <div className="px-4 py-2.5 text-sm text-dark-text tabular-nums">
              {formatRange(row.startMin, row.endMin, offset)}
            </div>
            <div className={`px-4 py-2.5 text-sm ${rowActivity[row.type]}`}>
              {row.activity}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-muted-text">
          <span className={`w-3 h-3 rounded-sm border inline-block ${legendClass}`} />
          Class time
        </span>
        <span className={`flex items-center gap-1.5 text-xs ${legendBreakText}`}>
          <span className={`w-3 h-3 rounded-sm border inline-block ${legendBreak}`} />
          Break
        </span>
        <span className={`flex items-center gap-1.5 text-xs ${legendLunchText}`}>
          <span className={`w-3 h-3 rounded-sm border inline-block ${legendLunch}`} />
          Lunch
        </span>
      </div>
    </div>
  )
}

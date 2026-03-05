'use client'
import { useState, useRef } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Mo','Tu','We','Th','Fr','Sa','Su']

type Highlight = { start: string; end?: string; color: 'teal' | 'amber' | 'purple'; label?: string }

interface Props {
  highlights: Highlight[]
  initialDate: string  // ISO date — month to open on
  label: string
}

function parseLocal(d: string) {
  return new Date(d + 'T12:00:00')
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const RANGE_BG: Record<string, string> = {
  teal:   'bg-teal-primary text-white',
  amber:  'bg-amber-500 text-white',
  purple: 'bg-purple-primary text-white',
}
const MID_BG: Record<string, string> = {
  teal:   'bg-teal-light text-teal-primary',
  amber:  'bg-amber-100 text-amber-800',
  purple: 'bg-purple-light text-purple-primary',
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

export default function CalendarPopover({ highlights, initialDate, label }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const init = parseLocal(initialDate)
  const [viewYear, setViewYear] = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build grid cells
  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startDow = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = [...Array(startDow).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const getDayStyle = (day: number) => {
    const date = new Date(viewYear, viewMonth, day)
    for (const h of highlights) {
      const start = parseLocal(h.start)
      const end = h.end ? parseLocal(h.end) : start
      if (sameDay(date, start) || sameDay(date, end)) return RANGE_BG[h.color]
      if (date > start && date < end) return MID_BG[h.color]
    }
    return null
  }

  const handleOpen = () => {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const popW = 288 // w-72
      const left = Math.min(r.right - popW, window.innerWidth - popW - 8)
      setPos({ top: r.bottom + 6, left: Math.max(8, left) })
    }
    setOpen(true)
  }

  return (
    <div className="inline-block">
      <button
        ref={btnRef}
        onClick={handleOpen}
        title={`View ${label} on calendar`}
        className="p-1 text-muted-text hover:text-teal-primary transition-colors"
      >
        <CalendarIcon />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-surface rounded-xl border border-border shadow-xl p-4 w-72"
            style={{ top: pos.top, left: pos.left }}>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1 text-muted-text hover:text-dark-text rounded-lg hover:bg-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-sm font-semibold text-dark-text">{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="p-1 text-muted-text hover:text-dark-text rounded-lg hover:bg-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map(d => (
                <span key={d} className="text-center text-xs text-muted-text font-medium py-0.5">{d}</span>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const style = getDayStyle(day)
                return (
                  <div
                    key={i}
                    className={`text-center text-xs py-1.5 rounded-md font-medium ${style ?? 'text-dark-text hover:bg-border/20'}`}
                  >
                    {day}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1">
              {highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-text">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${RANGE_BG[h.color].split(' ')[0]}`} />
                  <span>{h.label ?? (h.end && h.end !== h.start ? `${h.start} – ${h.end}` : h.start)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

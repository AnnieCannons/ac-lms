'use client'
import { useState, useRef } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']
const WEEKEND_COL = new Set([0, 6])

type Highlight = { start: string; end?: string; color: 'teal' | 'amber' | 'purple'; label?: string }

function fmtDate(iso: string) {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

interface Props {
  highlights: Highlight[]
  initialDate: string
  label: string
  editHref?: string
}

function parseLocal(d: string) { return new Date(d + 'T12:00:00') }
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

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function MonthGrid({ year, month, highlights, showTitle = true }: { year: number; month: number; highlights: Highlight[]; showTitle?: boolean }) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow = firstDay.getDay()
  const cells: (number | null)[] = [...Array(startDow).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const getDayStyle = (day: number) => {
    const date = new Date(year, month, day)
    for (const h of highlights) {
      const start = parseLocal(h.start)
      const end = h.end ? parseLocal(h.end) : start
      if (sameDay(date, start) || sameDay(date, end)) return RANGE_BG[h.color]
      if (date > start && date < end) return MID_BG[h.color]
    }
    return null
  }

  return (
    <div>
      {showTitle && <p className="text-sm font-semibold text-dark-text text-center mb-2">{MONTHS[month]} {year}</p>}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map((d, col) => (
          <span key={d} className={`text-center text-xs font-medium py-0.5 ${WEEKEND_COL.has(col) ? 'text-border' : 'text-muted-text'}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const col = i % 7
          const style = getDayStyle(day)
          return (
            <div key={i} className={`text-center text-xs py-1.5 rounded-md font-medium ${
              style ?? (WEEKEND_COL.has(col) ? 'text-border' : 'text-dark-text')
            }`}>
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarPopover({ highlights, initialDate, label, editHref }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, maxH: 600 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const init = parseLocal(initialDate)
  const [viewYear, setViewYear] = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())

  // Detect if primary highlight spans multiple months → show all month grids
  const primary = highlights[0]
  const primaryStart = primary ? parseLocal(primary.start) : null
  const primaryEnd = primary?.end ? parseLocal(primary.end) : primaryStart
  const spansMultipleMonths = primaryStart && primaryEnd &&
    (primaryStart.getFullYear() !== primaryEnd.getFullYear() ||
     primaryStart.getMonth() !== primaryEnd.getMonth())

  // Build list of every month from start to end
  const allMonthsInRange: Array<{ year: number; month: number }> = []
  if (spansMultipleMonths && primaryStart && primaryEnd) {
    let y = primaryStart.getFullYear(), m = primaryStart.getMonth()
    const endY = primaryEnd.getFullYear(), endM = primaryEnd.getMonth()
    while (y < endY || (y === endY && m <= endM)) {
      allMonthsInRange.push({ year: y, month: m })
      m++; if (m > 11) { m = 0; y++ }
    }
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleOpen = () => {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const popW = 288
      const popH = spansMultipleMonths ? Math.min(allMonthsInRange.length * 240 + 150, window.innerHeight * 0.85) : 520
      const left = Math.min(r.right - popW, window.innerWidth - popW - 8)
      const spaceBelow = window.innerHeight - r.bottom
      const spaceAbove = r.top
      const openBelow = spaceBelow >= popH || spaceBelow >= spaceAbove
      const top = openBelow ? r.bottom + 6 : Math.max(8, r.top - popH - 6)
      const maxH = openBelow
        ? window.innerHeight - (r.bottom + 6) - 8
        : r.top - 6 - 8
      setPos({ top, left: Math.max(8, left), maxH: Math.max(200, maxH) })
    }
    // Reset to start month when opening
    if (primaryStart) { setViewYear(primaryStart.getFullYear()); setViewMonth(primaryStart.getMonth()) }
    setOpen(true)
  }

  return (
    <div className="inline-block">
      <button ref={btnRef} onClick={handleOpen}
        aria-label={`View ${label} on calendar`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="p-1 text-muted-text hover:text-teal-primary transition-colors">
        <CalendarIcon />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${label} calendar`}
            onKeyDown={e => e.key === 'Escape' && setOpen(false)}
            className="fixed z-50 bg-surface rounded-xl border border-border shadow-xl p-4 w-72 overflow-y-auto"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH }}>

            {spansMultipleMonths ? (
              /* All months in range, scrollable */
              <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: Math.min(allMonthsInRange.length * 240 + 20, window.innerHeight * 0.6) }}>
                {allMonthsInRange.map(({ year, month }, i) => (
                  <div key={`${year}-${month}`}>
                    {i > 0 && <div className="border-t border-border mb-4" />}
                    <MonthGrid year={year} month={month} highlights={highlights} />
                  </div>
                ))}
              </div>
            ) : (
              /* Single month with nav for holidays / same-month ranges */
              <>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={prevMonth} className="p-1 text-muted-text hover:text-dark-text rounded-lg hover:bg-border/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span className="text-sm font-semibold text-dark-text">{MONTHS[viewMonth]} {viewYear}</span>
                  <button onClick={nextMonth} className="p-1 text-muted-text hover:text-dark-text rounded-lg hover:bg-border/20">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
                <MonthGrid year={viewYear} month={viewMonth} highlights={highlights} showTitle={false} />
              </>
            )}

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-border flex flex-col gap-0.5">
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                {highlights.map((h, i) => {
                  const d = parseLocal(h.start)
                  return (
                    <button key={i}
                      onClick={() => { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }}
                      className="flex items-start gap-2 text-xs text-muted-text hover:text-dark-text text-left w-full rounded px-1 py-0.5 hover:bg-border/20 transition-colors"
                    >
                      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5 ${RANGE_BG[h.color].split(' ')[0]}`} />
                      <span>
                        <span className="text-dark-text font-medium">
                          {fmtDate(h.start)}{h.end && h.end !== h.start ? ` – ${fmtDate(h.end)}` : ''}
                        </span>
                        {h.label && <span className="ml-1">· {h.label}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              {editHref && (
                <a href={editHref} className="mt-2 text-xs text-teal-primary hover:underline self-start">
                  Edit holidays →
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

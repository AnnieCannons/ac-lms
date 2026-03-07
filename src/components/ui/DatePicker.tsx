'use client'
import { useState, useRef } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']
const WEEKEND_COL = new Set([0, 6])

// value / onChange use "YYYY-MM-DD" strings
interface Props {
  value: string
  onChange: (date: string) => void
  placeholder?: string
}

function fmt(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DatePicker({ value, onChange, placeholder = 'Select date…' }: Props) {
  const today = new Date()
  const initial = value
    ? (() => { const [y, m] = value.split('-').map(Number); return { year: y, month: m - 1 } })()
    : { year: today.getFullYear(), month: today.getMonth() }

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initial.year)
  const [viewMonth, setViewMonth] = useState(initial.month)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const handleOpen = () => {
    if (open) { setOpen(false); return }
    if (value) {
      const [y, m] = value.split('-').map(Number)
      setViewYear(y); setViewMonth(m - 1)
    }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const popW = 320
      const popH = 360
      const left = Math.min(r.left, window.innerWidth - popW - 8)
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow < popH ? Math.max(8, r.top - popH - 6) : r.bottom + 6
      setPos({ top, left: Math.max(8, left) })
    }
    setOpen(true)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  const clear = () => { onChange(''); setOpen(false) }

  // Build cells
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null)]
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedDay = value
    ? (() => { const [y, m, d] = value.split('-').map(Number); return (y === viewYear && m - 1 === viewMonth) ? d : null })()
    : null

  const todayDay = (today.getFullYear() === viewYear && today.getMonth() === viewMonth) ? today.getDate() : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-3 border border-border rounded-xl px-5 py-4 bg-background text-dark-text hover:border-teal-primary transition-colors text-base min-w-[260px]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-muted-text shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={value ? 'text-dark-text' : 'text-muted-text'}>{value ? fmt(value) : placeholder}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 bg-surface rounded-2xl border border-border shadow-2xl p-5 w-80"
            style={{ top: pos.top, left: pos.left }}
          >
            {/* Nav */}
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={prevMonth} className="p-1.5 text-muted-text hover:text-dark-text rounded-lg hover:bg-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-base font-semibold text-dark-text">{MONTHS[viewMonth]} {viewYear}</span>
              <button type="button" onClick={nextMonth} className="p-1.5 text-muted-text hover:text-dark-text rounded-lg hover:bg-border/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map((d, col) => (
                <span key={d} className={`text-center text-xs font-semibold py-1 ${WEEKEND_COL.has(col) ? 'text-border' : 'text-muted-text'}`}>{d}</span>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const col = i % 7
                const isSelected = day === selectedDay
                const isToday = day === todayDay
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`text-center text-sm py-2 rounded-lg font-medium transition-colors ${
                      isSelected
                        ? 'bg-teal-primary text-white'
                        : isToday
                        ? 'border border-teal-primary text-teal-primary hover:bg-teal-light'
                        : WEEKEND_COL.has(col)
                        ? 'text-border hover:bg-border/20'
                        : 'text-dark-text hover:bg-border/20'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <button type="button" onClick={clear} className="text-xs text-muted-text hover:text-dark-text">Clear</button>
              <button type="button" onClick={() => {
                setViewYear(today.getFullYear())
                setViewMonth(today.getMonth())
              }} className="text-xs text-teal-primary hover:underline">Today</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

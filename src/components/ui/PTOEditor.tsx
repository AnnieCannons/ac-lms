'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type BreakRow   = { id?: string; label: string; start_date: string; end_date: string }
type HolidayRow = { id?: string; label: string; date_display: string; date: string; end_date?: string | null; year: number }

const inputCls = 'bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary w-full'
const CURRENT_YEAR = new Date().getFullYear()

export default function PTOEditor() {
  const [breaks,           setBreaks]           = useState<BreakRow[]>([])
  const [deletedBreakIds,  setDeletedBreakIds]  = useState<string[]>([])
  const [breakSaving,      setBreakSaving]      = useState(false)
  const [breakError,       setBreakError]       = useState('')

  const [holidayYear,      setHolidayYear]      = useState(CURRENT_YEAR)
  const [holidays,         setHolidays]         = useState<HolidayRow[]>([])
  const [deletedHolidayIds, setDeletedHolidayIds] = useState<string[]>([])
  const [holidaySaving,    setHolidaySaving]    = useState(false)
  const [holidayError,     setHolidayError]     = useState('')
  const [copying,          setCopying]          = useState(false)
  const [loading,          setLoading]          = useState(true)

  useEffect(() => {
    createClient()
      .from('calendar_breaks')
      .select('*')
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        setBreaks(data ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    createClient()
      .from('calendar_holidays')
      .select('*')
      .eq('year', holidayYear)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setHolidays(data ?? [])
        setDeletedHolidayIds([])
      })
  }, [holidayYear])

  const addBreak = () =>
    setBreaks(prev => [...prev, { label: '', start_date: '', end_date: '' }])

  const removeBreak = (i: number) => {
    const row = breaks[i]
    if (row.id) setDeletedBreakIds(prev => [...prev, row.id!])
    setBreaks(prev => prev.filter((_, j) => j !== i))
  }

  const saveBreaks = async () => {
    setBreakSaving(true)
    setBreakError('')
    const supabase = createClient()
    if (deletedBreakIds.length) await supabase.from('calendar_breaks').delete().in('id', deletedBreakIds)
    const existing = breaks.filter(b => b.id)
    const created  = breaks.filter(b => !b.id).map(b => ({ label: b.label, start_date: b.start_date, end_date: b.end_date }))
    const ops = []
    if (existing.length) ops.push(supabase.from('calendar_breaks').upsert(existing))
    if (created.length)  ops.push(supabase.from('calendar_breaks').insert(created))
    const results = await Promise.all(ops)
    const err = results.find(r => r.error)?.error
    if (err) { setBreakError(err.message); setBreakSaving(false); return }
    const { data } = await supabase.from('calendar_breaks').select('*').order('start_date', { ascending: true })
    setBreaks(data ?? [])
    setDeletedBreakIds([])
    setBreakSaving(false)
  }

  const addHoliday = () =>
    setHolidays(prev => [...prev, { label: '', date_display: '', date: '', end_date: null, year: holidayYear }])

  const removeHoliday = (i: number) => {
    const row = holidays[i]
    if (row.id) setDeletedHolidayIds(prev => [...prev, row.id!])
    setHolidays(prev => prev.filter((_, j) => j !== i))
  }

  const saveHolidays = async () => {
    setHolidaySaving(true)
    setHolidayError('')
    const supabase = createClient()
    if (deletedHolidayIds.length) await supabase.from('calendar_holidays').delete().in('id', deletedHolidayIds)
    const existing = holidays.filter(h => h.id)
    const created  = holidays.filter(h => !h.id).map(h => ({ label: h.label, date_display: h.date_display, date: h.date, end_date: h.end_date || null, year: holidayYear }))
    const ops = []
    if (existing.length) ops.push(supabase.from('calendar_holidays').upsert(existing))
    if (created.length)  ops.push(supabase.from('calendar_holidays').insert(created))
    const results = await Promise.all(ops)
    const err = results.find(r => r.error)?.error
    if (err) { setHolidayError(err.message); setHolidaySaving(false); return }
    const { data } = await supabase.from('calendar_holidays').select('*').eq('year', holidayYear).order('date', { ascending: true })
    setHolidays(data ?? [])
    setDeletedHolidayIds([])
    setHolidaySaving(false)
  }

  const copyToNextYear = async () => {
    if (!holidays.length) return
    setCopying(true)
    const nextYear = holidayYear + 1
    const rows = holidays.map(h => ({ label: h.label, date_display: h.date_display, date: h.date, end_date: h.end_date || null, year: nextYear }))
    await createClient().from('calendar_holidays').insert(rows)
    setHolidayYear(nextYear)
    setCopying(false)
  }

  if (loading) return <p className="text-sm text-muted-text">Loading…</p>

  return (
    <div className="flex flex-col gap-6">
      {/* Breaks */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-dark-text mb-4">Breaks</h2>
        <div className="flex flex-col gap-2 mb-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2">
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Label</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Start Date</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">End Date</span>
            <span />
          </div>
          {breaks.length === 0 && (
            <p className="text-sm text-muted-text italic py-2">No breaks added yet.</p>
          )}
          {breaks.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
              <input
                value={b.label}
                onChange={e => setBreaks(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                placeholder="e.g. Thanksgiving Week"
                className={inputCls}
              />
              <input
                type="date"
                value={b.start_date}
                onChange={e => setBreaks(prev => prev.map((r, j) => j === i ? { ...r, start_date: e.target.value } : r))}
                className={inputCls}
              />
              <input
                type="date"
                value={b.end_date}
                onChange={e => setBreaks(prev => prev.map((r, j) => j === i ? { ...r, end_date: e.target.value } : r))}
                className={inputCls}
              />
              <button
                onClick={() => removeBreak(i)}
                className="text-muted-text hover:text-red-500 transition-colors text-lg font-bold leading-none"
                aria-label="Remove break"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={addBreak} className="text-sm text-teal-primary font-medium hover:underline">
            + Add break
          </button>
          <button
            onClick={saveBreaks}
            disabled={breakSaving}
            className="bg-teal-primary text-white text-sm font-semibold px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {breakSaving ? 'Saving…' : 'Save breaks'}
          </button>
          {breakError && <p className="text-sm text-red-500">{breakError}</p>}
        </div>
      </div>

      {/* Holidays */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-dark-text">Holidays</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHolidayYear(y => y - 1)}
              className="px-2 py-1 text-sm border border-border rounded-lg hover:border-teal-primary text-muted-text hover:text-teal-primary"
            >←</button>
            <span className="text-sm font-semibold text-dark-text w-12 text-center">{holidayYear}</span>
            <button
              onClick={() => setHolidayYear(y => y + 1)}
              className="px-2 py-1 text-sm border border-border rounded-lg hover:border-teal-primary text-muted-text hover:text-teal-primary"
            >→</button>
            {holidays.length > 0 && (
              <button
                onClick={copyToNextYear}
                disabled={copying}
                className="ml-2 text-xs text-teal-primary font-medium hover:underline disabled:opacity-50"
              >
                {copying ? 'Copying…' : `Copy to ${holidayYear + 1} →`}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 mb-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2">
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Holiday Name</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Display (e.g. Mon, Jan 19)</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Start Date</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">End Date (optional)</span>
            <span />
          </div>
          {holidays.length === 0 && (
            <p className="text-sm text-muted-text italic py-2">No holidays for {holidayYear} yet.</p>
          )}
          {holidays.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-2 items-center">
              <input
                value={h.label}
                onChange={e => setHolidays(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                placeholder="e.g. Labor Day"
                className={inputCls}
              />
              <input
                value={h.date_display}
                onChange={e => setHolidays(prev => prev.map((r, j) => j === i ? { ...r, date_display: e.target.value } : r))}
                placeholder="e.g. Mon, Sep 7"
                className={inputCls}
              />
              <input
                type="date"
                value={h.date}
                onChange={e => setHolidays(prev => prev.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                className={inputCls}
              />
              <input
                type="date"
                value={h.end_date ?? ''}
                onChange={e => setHolidays(prev => prev.map((r, j) => j === i ? { ...r, end_date: e.target.value || null } : r))}
                className={inputCls}
              />
              <button
                onClick={() => removeHoliday(i)}
                className="text-muted-text hover:text-red-500 transition-colors text-lg font-bold leading-none"
                aria-label="Remove"
              >×</button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={addHoliday} className="text-sm text-teal-primary font-medium hover:underline">
            + Add holiday
          </button>
          <button
            onClick={saveHolidays}
            disabled={holidaySaving}
            className="bg-teal-primary text-white text-sm font-semibold px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {holidaySaving ? 'Saving…' : 'Save holidays'}
          </button>
          {holidayError && <p className="text-sm text-red-500">{holidayError}</p>}
        </div>
      </div>
    </div>
  )
}

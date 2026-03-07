'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import YearlyScheduleSection from '@/components/ui/YearlyScheduleSection'

type CohortRow   = { id?: string; name: string; start_date: string; end_date: string; order: number }
type BreakRow    = { id?: string; label: string; start_date: string; end_date: string }
type HolidayRow  = { id?: string; label: string; date_display: string; date: string; end_date?: string | null; year: number }

const inputCls = 'bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary w-full'

const CURRENT_YEAR = new Date().getFullYear()

export default function CalendarEditor() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([])
  const [breaks,  setBreaks]  = useState<BreakRow[]>([])
  const [deletedCohortIds, setDeletedCohortIds] = useState<string[]>([])
  const [deletedBreakIds,  setDeletedBreakIds]  = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [previewKey, setPreviewKey] = useState(0)

  // Holidays
  const [holidayYear,    setHolidayYear]    = useState(CURRENT_YEAR)
  const [holidays,       setHolidays]       = useState<HolidayRow[]>([])
  const [deletedHolidayIds, setDeletedHolidayIds] = useState<string[]>([])
  const [holidaySaving,  setHolidaySaving]  = useState(false)
  const [holidayError,   setHolidayError]   = useState('')
  const [copying,        setCopying]        = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('calendar_cohorts').select('*').order('start_date', { ascending: true }),
      supabase.from('calendar_breaks').select('*').order('start_date', { ascending: true }),
    ]).then(([{ data: c, error: ce }, { data: b, error: be }]) => {
      if (ce || be) setError((ce ?? be)!.message)
      setCohorts(c ?? [])
      setBreaks(b ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('calendar_holidays').select('*').eq('year', holidayYear).order('date', { ascending: true })
      .then(({ data }) => {
        setHolidays(data ?? [])
        setDeletedHolidayIds([])
      })
  }, [holidayYear])

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
    setPreviewKey(k => k + 1)
  }

  const copyToNextYear = async () => {
    if (!holidays.length) return
    setCopying(true)
    const supabase = createClient()
    const nextYear = holidayYear + 1
    const rows = holidays.map(h => ({ label: h.label, date_display: h.date_display, date: h.date, end_date: h.end_date || null, year: nextYear }))
    await supabase.from('calendar_holidays').insert(rows)
    setHolidayYear(nextYear)
    setCopying(false)
  }

  const addCohort = () =>
    setCohorts(prev => [...prev, { name: '', start_date: '', end_date: '', order: prev.length }])

  const addBreak = () =>
    setBreaks(prev => [...prev, { label: '', start_date: '', end_date: '' }])

  const removeCohort = (i: number) => {
    const row = cohorts[i]
    if (row.id) setDeletedCohortIds(prev => [...prev, row.id!])
    setCohorts(prev => prev.filter((_, j) => j !== i))
  }

  const removeBreak = (i: number) => {
    const row = breaks[i]
    if (row.id) setDeletedBreakIds(prev => [...prev, row.id!])
    setBreaks(prev => prev.filter((_, j) => j !== i))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const supabase = createClient()

    // Delete removed rows
    if (deletedCohortIds.length) await supabase.from('calendar_cohorts').delete().in('id', deletedCohortIds)
    if (deletedBreakIds.length)  await supabase.from('calendar_breaks').delete().in('id', deletedBreakIds)

    // Split existing vs new
    const existingCohorts = cohorts.filter(c => c.id).map((c, i) => ({ ...c, order: i }))
    const newCohorts      = cohorts.filter(c => !c.id).map((c, i) => ({ name: c.name, start_date: c.start_date, end_date: c.end_date, order: existingCohorts.length + i }))
    const existingBreaks  = breaks.filter(b => b.id)
    const newBreaks       = breaks.filter(b => !b.id).map(b => ({ label: b.label, start_date: b.start_date, end_date: b.end_date }))

    const ops = []
    if (existingCohorts.length) ops.push(supabase.from('calendar_cohorts').upsert(existingCohorts))
    if (newCohorts.length)      ops.push(supabase.from('calendar_cohorts').insert(newCohorts))
    if (existingBreaks.length)  ops.push(supabase.from('calendar_breaks').upsert(existingBreaks))
    if (newBreaks.length)       ops.push(supabase.from('calendar_breaks').insert(newBreaks))

    const results = await Promise.all(ops)
    const firstError = results.find(r => r.error)?.error
    if (firstError) {
      setError(firstError.message)
      setSaving(false)
      return
    }

    // Re-fetch stable IDs
    const [{ data: fc }, { data: fb }] = await Promise.all([
      supabase.from('calendar_cohorts').select('*').order('start_date', { ascending: true }),
      supabase.from('calendar_breaks').select('*').order('start_date', { ascending: true }),
    ])
    setCohorts(fc ?? [])
    setBreaks(fb ?? [])
    setDeletedCohortIds([])
    setDeletedBreakIds([])
    setSaving(false)
    setPreviewKey(k => k + 1)
  }

  if (loading) return <p className="text-sm text-muted-text">Loading…</p>

  return (
    <div className="flex flex-col gap-8">
      {/* Cohorts */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-dark-text mb-4">Cohorts</h2>
        <div className="flex flex-col gap-2 mb-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2">
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Name</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Start Date</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">End Date</span>
            <span />
          </div>
          {cohorts.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
              <select
                value={c.name}
                onChange={e => setCohorts(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                className={inputCls}
              >
                <option value="">— Select —</option>
                <option value="Winter">Winter</option>
                <option value="Summer">Summer</option>
                <option value="Fall">Fall</option>
              </select>
              <input
                type="date"
                value={c.start_date}
                onChange={e => setCohorts(prev => prev.map((r, j) => j === i ? { ...r, start_date: e.target.value } : r))}
                className={inputCls}
              />
              <input
                type="date"
                value={c.end_date}
                onChange={e => setCohorts(prev => prev.map((r, j) => j === i ? { ...r, end_date: e.target.value } : r))}
                className={inputCls}
              />
              <button
                onClick={() => removeCohort(i)}
                className="text-muted-text hover:text-red-500 transition-colors"
                aria-label="Remove cohort"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={addCohort} className="text-sm text-teal-primary font-medium hover:underline">
          + Add cohort
        </button>
      </div>

      {/* Breaks */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-dark-text mb-4">School Breaks</h2>
        <div className="flex flex-col gap-2 mb-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2">
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Label</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Start Date</span>
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">End Date</span>
            <span />
          </div>
          {breaks.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
              <input
                value={b.label}
                onChange={e => setBreaks(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                placeholder="e.g. Spring Break"
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
                className="text-muted-text hover:text-red-500 transition-colors"
                aria-label="Remove break"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={addBreak} className="text-sm text-teal-primary font-medium hover:underline">
          + Add break
        </button>
      </div>

      {/* Save cohorts/breaks */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-primary text-white text-sm font-semibold px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Holidays */}
      <div className="bg-surface rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-dark-text">Holidays</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setHolidayYear(y => y - 1)} className="px-2 py-1 text-sm border border-border rounded-lg hover:border-teal-primary text-muted-text hover:text-teal-primary">←</button>
            <span className="text-sm font-semibold text-dark-text w-12 text-center">{holidayYear}</span>
            <button onClick={() => setHolidayYear(y => y + 1)} className="px-2 py-1 text-sm border border-border rounded-lg hover:border-teal-primary text-muted-text hover:text-teal-primary">→</button>
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
            <span className="text-xs font-semibold text-muted-text uppercase tracking-wide px-1">Display Date (e.g. Mon, Jan 19)</span>
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
              <button onClick={() => removeHoliday(i)} className="text-muted-text hover:text-red-500 transition-colors" aria-label="Remove holiday"><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button onClick={addHoliday} className="text-sm text-teal-primary font-medium hover:underline">+ Add holiday</button>
          <button onClick={saveHolidays} disabled={holidaySaving} className="bg-teal-primary text-white text-sm font-semibold px-6 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity">
            {holidaySaving ? 'Saving…' : 'Save holidays'}
          </button>
          {holidayError && <p className="text-sm text-red-500">{holidayError}</p>}
        </div>
      </div>

      {/* Preview */}
      <div>
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">
          Preview — what students will see
        </p>
        <YearlyScheduleSection key={previewKey} />
      </div>
    </div>
  )
}

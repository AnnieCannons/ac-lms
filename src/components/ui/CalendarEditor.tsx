'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import YearlyScheduleSection from '@/components/ui/YearlyScheduleSection'

type CohortRow = { id?: string; name: string; start_date: string; end_date: string; order: number }
type BreakRow  = { id?: string; label: string; start_date: string; end_date: string }

const inputCls = 'bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary w-full'

export default function CalendarEditor() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([])
  const [breaks,  setBreaks]  = useState<BreakRow[]>([])
  const [deletedCohortIds, setDeletedCohortIds] = useState<string[]>([])
  const [deletedBreakIds,  setDeletedBreakIds]  = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [previewKey, setPreviewKey] = useState(0)

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
                className="text-muted-text hover:text-red-500 transition-colors text-lg font-bold leading-none"
                aria-label="Remove cohort"
              >
                ×
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
                className="text-muted-text hover:text-red-500 transition-colors text-lg font-bold leading-none"
                aria-label="Remove break"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button onClick={addBreak} className="text-sm text-teal-primary font-medium hover:underline">
          + Add break
        </button>
      </div>

      {/* Save */}
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

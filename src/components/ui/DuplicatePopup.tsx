'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const SKIP_DAYS = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])

// ─── Shared icon ─────────────────────────────────────────────────────────────

export function DuplicateIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

type WeekModule = { id: string; title: string | null; week: number | null; days: string[] }
type Course = { id: string; name: string }
type OtherModule = { id: string; title: string; module_days: { id: string; day_name: string; order: number }[] }

// ─── Types returned by the popup ─────────────────────────────────────────────

export type DuplicatedAssignment = {
  id: string; title: string; description: string | null; how_to_turn_in: string | null;
  due_date: string | null; published: boolean; order: number; module_day_id: string;
  skill_tags?: string[] | null; is_bonus?: boolean | null;
}

export type DuplicatedModule = {
  id: string; title: string; week_number: number | null; order: number;
  course_id: string; category: string | null; published: boolean;
  module_days: {
    id: string; day_name: string; order: number; module_id: string;
    assignments: DuplicatedAssignment[];
  }[]
}

// ─── DuplicateAssignmentPopup ─────────────────────────────────────────────────

interface DuplicateAssignmentProps {
  assignment: {
    id: string; title: string; description: string | null; how_to_turn_in: string | null;
    due_date: string | null; skill_tags?: string[] | null; is_bonus?: boolean | null;
  }
  currentCourseId: string
  currentModuleId: string
  weekModules: WeekModule[]
  popupPos: { top: number; left: number }
  popupRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onDuplicatedInCourse: (assignment: DuplicatedAssignment, targetDayId: string) => void
}

export function DuplicateAssignmentPopup({
  assignment, currentCourseId, currentModuleId, weekModules,
  popupPos, popupRef, onClose, onDuplicatedInCourse,
}: DuplicateAssignmentProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<'same' | 'other'>('same')

  // Same course
  const [sameModule, setSameModule] = useState(currentModuleId)
  const [sameDay, setSameDay] = useState('')

  // Other course
  const [courses, setCourses] = useState<Course[]>([])
  const [otherCourse, setOtherCourse] = useState('')
  const [otherModules, setOtherModules] = useState<OtherModule[]>([])
  const [otherModule, setOtherModule] = useState('')
  const [otherDay, setOtherDay] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [loadingModules, setLoadingModules] = useState(false)

  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load courses when switching to "other" tab
  useEffect(() => {
    if (tab !== 'other' || courses.length > 0) return
    setLoadingCourses(true)
    supabase.from('courses').select('id, name').order('name').then(({ data }) => {
      setCourses((data ?? []).filter(c => c.id !== currentCourseId))
      setLoadingCourses(false)
    })
  }, [tab])

  // Load modules when other course is selected
  useEffect(() => {
    if (!otherCourse) return
    setLoadingModules(true)
    setOtherModules([])
    setOtherModule('')
    setOtherDay('')
    supabase.from('modules')
      .select('id, title, module_days(id, day_name, order)')
      .eq('course_id', otherCourse)
      .order('order', { ascending: true })
      .then(({ data }) => {
        const mods = (data ?? []).filter((m: OtherModule) => m.title && !m.title.includes('DO NOT PUBLISH'))
        setOtherModules(mods)
        setOtherModule(mods[0]?.id ?? '')
        setLoadingModules(false)
      })
  }, [otherCourse])

  const sameDays = (() => {
    const mod = weekModules.find(m => m.id === sameModule)
    const existing = mod?.days ?? []
    const extra = existing.filter(d => !DAY_OPTIONS.includes(d) && !SKIP_DAYS.has(d))
    return [...new Set([...extra, ...DAY_OPTIONS])]
  })()

  const otherDays = (() => {
    const mod = otherModules.find(m => m.id === otherModule)
    const existing = (mod?.module_days ?? []).map(d => d.day_name)
    const extra = existing.filter(d => !DAY_OPTIONS.includes(d) && !SKIP_DAYS.has(d))
    return [...new Set([...extra, ...DAY_OPTIONS])]
  })()

  async function resolveDayId(moduleId: string, dayName: string, courseId: string): Promise<string | null> {
    // Check if day exists in otherModules state
    const mod = otherModules.find(m => m.id === moduleId)
    const existing = mod?.module_days.find(d => d.day_name === dayName)
    if (existing) return existing.id
    // Create it
    const { data, error } = await supabase.from('module_days')
      .insert({ module_id: moduleId, day_name: dayName, order: (mod?.module_days.length ?? 0) })
      .select('id').single()
    if (error || !data) { setError('Failed to create day'); return null }
    return data.id
  }

  async function copyAssignment(targetDayId: string): Promise<DuplicatedAssignment | null> {
    // Get checklist items
    const { data: checklist } = await supabase.from('checklist_items')
      .select('text, description, order, required').eq('assignment_id', assignment.id)
    const order = 999 // will be corrected by parent if same course

    const { data: newA, error: aErr } = await supabase.from('assignments').insert({
      module_day_id: targetDayId,
      title: assignment.title,
      description: assignment.description,
      how_to_turn_in: assignment.how_to_turn_in,
      due_date: assignment.due_date,
      published: false,
      order,
      skill_tags: assignment.skill_tags ?? [],
      is_bonus: assignment.is_bonus ?? false,
    }).select().single()
    if (aErr || !newA) { setError(aErr?.message ?? 'Failed to copy'); return null }

    if (checklist && checklist.length > 0) {
      await supabase.from('checklist_items').insert(
        checklist.map(ci => ({ ...ci, assignment_id: newA.id }))
      )
    }
    return newA as DuplicatedAssignment
  }

  async function handleCopy() {
    setError(null)
    setCopying(true)

    if (tab === 'same') {
      if (!sameModule || !sameDay) { setError('Pick a module and day'); setCopying(false); return }
      // Resolve day id from weekModules
      const mod = weekModules.find(m => m.id === sameModule)
      if (!mod) { setCopying(false); return }
      // If the day doesn't exist yet, we need to create it — call the API
      const existingDay = mod.days.includes(sameDay)
      let targetDayId: string | null = null
      if (existingDay) {
        // Fetch the actual day id from supabase
        const { data } = await supabase.from('module_days')
          .select('id').eq('module_id', sameModule).eq('day_name', sameDay).single()
        targetDayId = data?.id ?? null
      } else {
        // Create the day
        const { data, error: dErr } = await supabase.from('module_days')
          .insert({ module_id: sameModule, day_name: sameDay, order: mod.days.length })
          .select('id').single()
        if (dErr || !data) { setError('Failed to create day'); setCopying(false); return }
        targetDayId = data.id
      }
      if (!targetDayId) { setError('Could not find day'); setCopying(false); return }
      const newA = await copyAssignment(targetDayId)
      if (!newA) { setCopying(false); return }
      onDuplicatedInCourse(newA, targetDayId)
      setSuccess(true)
      setTimeout(onClose, 800)

    } else {
      if (!otherCourse || !otherModule || !otherDay) { setError('Pick a course, module, and day'); setCopying(false); return }
      const targetDayId = await resolveDayId(otherModule, otherDay, otherCourse)
      if (!targetDayId) { setCopying(false); return }
      const newA = await copyAssignment(targetDayId)
      if (!newA) { setCopying(false); return }
      setSuccess(true)
      setTimeout(onClose, 800)
    }
    setCopying(false)
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
      style={{ top: popupPos.top, left: popupPos.left, width: 300, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
    >
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Copy assignment</p>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['same', 'other'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(null) }}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${tab === t ? 'bg-teal-primary text-white border-teal-primary' : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'}`}>
            {t === 'same' ? 'This course' : 'Another course'}
          </button>
        ))}
      </div>

      {tab === 'same' ? (
        <>
          <select value={sameModule} onChange={e => { setSameModule(e.target.value); setSameDay('') }}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
            {weekModules.map(m => (
              <option key={m.id} value={m.id}>{m.title ?? (m.week != null ? `Week ${m.week}` : 'Unassigned')}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1">
            {sameDays.map(d => {
              const exists = (weekModules.find(m => m.id === sameModule)?.days ?? []).includes(d)
              return (
                <button key={d} type="button" onClick={() => setSameDay(d)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${sameDay === d ? 'bg-teal-primary border-teal-primary text-white' : exists ? 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary' : 'border-dashed border-border text-muted-text/60 hover:border-teal-primary hover:text-teal-primary'}`}
                  title={exists ? d : `Create "${d}" day`}>{d}</button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          {loadingCourses ? (
            <p className="text-xs text-muted-text">Loading courses…</p>
          ) : (
            <select value={otherCourse} onChange={e => setOtherCourse(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
              <option value="">— Select a course —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {otherCourse && (loadingModules ? (
            <p className="text-xs text-muted-text">Loading modules…</p>
          ) : (
            <>
              <select value={otherModule} onChange={e => { setOtherModule(e.target.value); setOtherDay('') }}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
                <option value="">— Select module —</option>
                {otherModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              {otherModule && (
                <div className="flex flex-wrap gap-1">
                  {otherDays.map(d => {
                    const exists = (otherModules.find(m => m.id === otherModule)?.module_days ?? []).some(md => md.day_name === d)
                    return (
                      <button key={d} type="button" onClick={() => setOtherDay(d)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${otherDay === d ? 'bg-teal-primary border-teal-primary text-white' : exists ? 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary' : 'border-dashed border-border text-muted-text/60 hover:border-teal-primary hover:text-teal-primary'}`}
                        title={exists ? d : `Create "${d}" day`}>{d}</button>
                    )
                  })}
                </div>
              )}
            </>
          ))}
        </>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-teal-primary font-medium">Copied!</p>}

      <button type="button" onClick={handleCopy}
        disabled={copying || success || (tab === 'same' ? !sameModule || !sameDay : !otherCourse || !otherModule || !otherDay)}
        className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
        {copying ? 'Copying…' : success ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  )
}

// ─── DuplicateModulePopup ─────────────────────────────────────────────────────

interface DuplicateModuleProps {
  module: {
    id: string; title: string; week_number: number | null; order: number;
    category: string | null; published: boolean;
    module_days: {
      id: string; day_name: string; order: number; module_id: string;
      assignments?: {
        id: string; title: string; description: string | null; how_to_turn_in: string | null;
        due_date: string | null; published: boolean; order: number; module_day_id: string;
        skill_tags?: string[] | null; is_bonus?: boolean | null;
      }[]
    }[]
  }
  currentCourseId: string
  currentModuleCount: number
  popupPos: { top: number; left: number }
  popupRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onDuplicatedInCourse: (newModule: DuplicatedModule) => void
}

export function DuplicateModulePopup({
  module, currentCourseId, currentModuleCount,
  popupPos, popupRef, onClose, onDuplicatedInCourse,
}: DuplicateModuleProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<'same' | 'other'>('same')
  const [courses, setCourses] = useState<Course[]>([])
  const [otherCourse, setOtherCourse] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (tab !== 'other' || courses.length > 0) return
    setLoadingCourses(true)
    supabase.from('courses').select('id, name').order('name').then(({ data }) => {
      setCourses((data ?? []).filter(c => c.id !== currentCourseId))
      setLoadingCourses(false)
    })
  }, [tab])

  async function duplicateModuleTo(targetCourseId: string): Promise<DuplicatedModule | null> {
    const isSameCourse = targetCourseId === currentCourseId
    const newTitle = isSameCourse ? `${module.title} (Copy)` : module.title

    // Get existing module count for new order
    const { data: existingMods } = await supabase.from('modules').select('id').eq('course_id', targetCourseId)
    const newOrder = (existingMods ?? []).length

    const { data: newMod, error: modErr } = await supabase.from('modules').insert({
      course_id: targetCourseId,
      title: newTitle,
      week_number: isSameCourse ? null : module.week_number,
      order: newOrder,
      category: module.category,
      published: false,
    }).select().single()
    if (modErr || !newMod) { setError(modErr?.message ?? 'Failed to copy module'); return null }

    const newDays: DuplicatedModule['module_days'] = []

    for (const day of [...module.module_days].sort((a, b) => a.order - b.order)) {
      const { data: newDay, error: dayErr } = await supabase.from('module_days').insert({
        module_id: newMod.id,
        day_name: day.day_name,
        order: day.order,
      }).select().single()
      if (dayErr || !newDay) { setError('Failed to copy day'); return null }

      const newAssignments: DuplicatedAssignment[] = []
      for (const a of (day.assignments ?? []).sort((x, y) => x.order - y.order)) {
        const { data: newA, error: aErr } = await supabase.from('assignments').insert({
          module_day_id: newDay.id,
          title: a.title,
          description: a.description,
          how_to_turn_in: a.how_to_turn_in,
          due_date: a.due_date,
          published: false,
          order: a.order,
          skill_tags: a.skill_tags ?? [],
          is_bonus: a.is_bonus ?? false,
        }).select().single()
        if (aErr || !newA) continue

        // Copy checklist items
        const { data: checklist } = await supabase.from('checklist_items')
          .select('text, description, order, required').eq('assignment_id', a.id)
        if (checklist && checklist.length > 0) {
          await supabase.from('checklist_items').insert(
            checklist.map(ci => ({ ...ci, assignment_id: newA.id }))
          )
        }
        newAssignments.push(newA as DuplicatedAssignment)
      }
      newDays.push({ ...newDay, module_id: newMod.id, assignments: newAssignments })
    }

    return { ...newMod, module_days: newDays } as DuplicatedModule
  }

  async function handleCopy() {
    setError(null)
    setCopying(true)
    const targetCourse = tab === 'same' ? currentCourseId : otherCourse
    if (!targetCourse) { setError('Pick a course'); setCopying(false); return }
    const result = await duplicateModuleTo(targetCourse)
    setCopying(false)
    if (!result) return
    if (tab === 'same') onDuplicatedInCourse(result)
    setSuccess(true)
    setTimeout(onClose, 800)
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
      style={{ top: popupPos.top, left: popupPos.left, width: 280, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
    >
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Copy module</p>

      <div className="flex gap-1">
        {(['same', 'other'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(null) }}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${tab === t ? 'bg-teal-primary text-white border-teal-primary' : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'}`}>
            {t === 'same' ? 'This course' : 'Another course'}
          </button>
        ))}
      </div>

      {tab === 'same' ? (
        <p className="text-xs text-muted-text">
          Creates <span className="text-dark-text font-medium">{module.title} (Copy)</span> with all days and assignments (unpublished).
        </p>
      ) : (
        loadingCourses ? (
          <p className="text-xs text-muted-text">Loading courses…</p>
        ) : (
          <select value={otherCourse} onChange={e => setOtherCourse(e.target.value)}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
            <option value="">— Select a course —</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-teal-primary font-medium">Copied!</p>}

      <button type="button" onClick={handleCopy}
        disabled={copying || success || (tab === 'other' && !otherCourse)}
        className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
        {copying ? 'Copying…' : success ? 'Copied ✓' : tab === 'same' ? 'Duplicate' : 'Copy to course'}
      </button>
    </div>
  )
}

// ─── Shared popup shell (tabs + day picker) ───────────────────────────────────

function DayPicker({ days, selected, onSelect }: { days: string[]; selected: string; onSelect: (d: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {days.map(d => (
        <button key={d} type="button" onClick={() => onSelect(d)}
          className={`text-xs px-2 py-1 rounded border transition-colors ${selected === d ? 'bg-teal-primary border-teal-primary text-white' : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'}`}>
          {d}
        </button>
      ))}
    </div>
  )
}

// ─── DuplicateResourcePopup ───────────────────────────────────────────────────

export type DuplicatedResource = {
  id: string; module_day_id: string; type: string; title: string;
  content: string | null; description: string | null; order: number; published: boolean;
}

interface DuplicateResourceProps {
  resource: { id: string; type: string; title: string; content: string | null; description: string | null }
  currentCourseId: string
  currentModuleId: string
  weekModules: WeekModule[]
  popupPos: { top: number; left: number }
  popupRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onDuplicatedInCourse: (resource: DuplicatedResource, targetDayId: string) => void
}

export function DuplicateResourcePopup({
  resource, currentCourseId, currentModuleId, weekModules,
  popupPos, popupRef, onClose, onDuplicatedInCourse,
}: DuplicateResourceProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<'same' | 'other'>('same')
  const [sameModule, setSameModule] = useState(currentModuleId)
  const [sameDay, setSameDay] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [otherCourse, setOtherCourse] = useState('')
  const [otherModules, setOtherModules] = useState<OtherModule[]>([])
  const [otherModule, setOtherModule] = useState('')
  const [otherDay, setOtherDay] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [loadingModules, setLoadingModules] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (tab !== 'other' || courses.length > 0) return
    setLoadingCourses(true)
    supabase.from('courses').select('id, name').order('name').then(({ data }) => {
      setCourses((data ?? []).filter(c => c.id !== currentCourseId))
      setLoadingCourses(false)
    })
  }, [tab])

  useEffect(() => {
    if (!otherCourse) return
    setLoadingModules(true)
    setOtherModules([]); setOtherModule(''); setOtherDay('')
    supabase.from('modules').select('id, title, module_days(id, day_name, order)')
      .eq('course_id', otherCourse).order('order', { ascending: true })
      .then(({ data }) => {
        const mods = (data ?? []).filter((m: OtherModule) => m.title && !m.title.includes('DO NOT PUBLISH'))
        setOtherModules(mods); setOtherModule(mods[0]?.id ?? ''); setLoadingModules(false)
      })
  }, [otherCourse])

  const sameDays = (() => {
    const existing = weekModules.find(m => m.id === sameModule)?.days ?? []
    const extra = existing.filter(d => !DAY_OPTIONS.includes(d) && !SKIP_DAYS.has(d))
    return [...new Set([...extra, ...DAY_OPTIONS])]
  })()

  const otherDays = (() => {
    const existing = (otherModules.find(m => m.id === otherModule)?.module_days ?? []).map(d => d.day_name)
    const extra = existing.filter(d => !DAY_OPTIONS.includes(d) && !SKIP_DAYS.has(d))
    return [...new Set([...extra, ...DAY_OPTIONS])]
  })()

  async function resolveDayId(moduleId: string, dayName: string): Promise<string | null> {
    const mod = otherModules.find(m => m.id === moduleId)
    const existing = mod?.module_days.find(d => d.day_name === dayName)
    if (existing) return existing.id
    const { data, error: e } = await supabase.from('module_days')
      .insert({ module_id: moduleId, day_name: dayName, order: mod?.module_days.length ?? 0 })
      .select('id').single()
    if (e || !data) { setError('Failed to create day'); return null }
    return data.id
  }

  async function handleCopy() {
    setError(null); setCopying(true)
    let targetDayId: string | null = null

    if (tab === 'same') {
      if (!sameModule || !sameDay) { setError('Pick a module and day'); setCopying(false); return }
      const mod = weekModules.find(m => m.id === sameModule)
      if (!mod) { setCopying(false); return }
      if (mod.days.includes(sameDay)) {
        const { data } = await supabase.from('module_days').select('id').eq('module_id', sameModule).eq('day_name', sameDay).single()
        targetDayId = data?.id ?? null
      } else {
        const { data, error: e } = await supabase.from('module_days').insert({ module_id: sameModule, day_name: sameDay, order: mod.days.length }).select('id').single()
        if (e || !data) { setError('Failed to create day'); setCopying(false); return }
        targetDayId = data.id
      }
    } else {
      if (!otherCourse || !otherModule || !otherDay) { setError('Pick a course, module, and day'); setCopying(false); return }
      targetDayId = await resolveDayId(otherModule, otherDay)
    }
    if (!targetDayId) { setCopying(false); return }

    const { data: r, error: e } = await supabase.from('resources').insert({
      module_day_id: targetDayId,
      type: resource.type,
      title: resource.title,
      content: resource.content,
      description: resource.description,
      published: false,
      order: 999,
    }).select().single()
    setCopying(false)
    if (e || !r) { setError(e?.message ?? 'Failed to copy'); return }
    if (tab === 'same') onDuplicatedInCourse(r as DuplicatedResource, targetDayId)
    setSuccess(true)
    setTimeout(onClose, 800)
  }

  return (
    <div ref={popupRef} className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
      style={{ top: popupPos.top, left: popupPos.left, width: 300, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Copy resource</p>
      <div className="flex gap-1">
        {(['same', 'other'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(null) }}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${tab === t ? 'bg-teal-primary text-white border-teal-primary' : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'}`}>
            {t === 'same' ? 'This course' : 'Another course'}
          </button>
        ))}
      </div>
      {tab === 'same' ? (
        <>
          <select value={sameModule} onChange={e => { setSameModule(e.target.value); setSameDay('') }}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
            {weekModules.map(m => <option key={m.id} value={m.id}>{m.title ?? (m.week != null ? `Week ${m.week}` : 'Unassigned')}</option>)}
          </select>
          <DayPicker days={sameDays} selected={sameDay} onSelect={setSameDay} />
        </>
      ) : (
        <>
          {loadingCourses ? <p className="text-xs text-muted-text">Loading courses…</p> : (
            <select value={otherCourse} onChange={e => setOtherCourse(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
              <option value="">— Select a course —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {otherCourse && (loadingModules ? <p className="text-xs text-muted-text">Loading modules…</p> : (
            <>
              <select value={otherModule} onChange={e => { setOtherModule(e.target.value); setOtherDay('') }}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
                <option value="">— Select module —</option>
                {otherModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              {otherModule && <DayPicker days={otherDays} selected={otherDay} onSelect={setOtherDay} />}
            </>
          ))}
        </>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-teal-primary font-medium">Copied!</p>}
      <button type="button" onClick={handleCopy}
        disabled={copying || success || (tab === 'same' ? !sameModule || !sameDay : !otherCourse || !otherModule || !otherDay)}
        className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
        {copying ? 'Copying…' : success ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  )
}

// ─── DuplicateQuizPopup ───────────────────────────────────────────────────────

export type DuplicatedQuiz = {
  id: string; title: string; questions: unknown[]; published: boolean;
  module_title: string; day_title: string | null; course_id: string;
}

interface DuplicateQuizProps {
  quiz: { id: string; title: string; questions: unknown[]; module_title: string; day_title: string | null }
  currentCourseId: string
  weekModules: WeekModule[]
  popupPos: { top: number; left: number }
  popupRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onDuplicatedInCourse: (quiz: DuplicatedQuiz) => void
}

export function DuplicateQuizPopup({
  quiz, currentCourseId, weekModules,
  popupPos, popupRef, onClose, onDuplicatedInCourse,
}: DuplicateQuizProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<'same' | 'other'>('same')
  const [sameModule, setSameModule] = useState(() => weekModules.find(m => m.title === quiz.module_title)?.id ?? weekModules[0]?.id ?? '')
  const [sameDay, setSameDay] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [otherCourse, setOtherCourse] = useState('')
  const [otherModules, setOtherModules] = useState<OtherModule[]>([])
  const [otherModule, setOtherModule] = useState('')
  const [otherDay, setOtherDay] = useState('')
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [loadingModules, setLoadingModules] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (tab !== 'other' || courses.length > 0) return
    setLoadingCourses(true)
    supabase.from('courses').select('id, name').order('name').then(({ data }) => {
      setCourses((data ?? []).filter(c => c.id !== currentCourseId))
      setLoadingCourses(false)
    })
  }, [tab])

  useEffect(() => {
    if (!otherCourse) return
    setLoadingModules(true)
    setOtherModules([]); setOtherModule(''); setOtherDay('')
    supabase.from('modules').select('id, title, module_days(id, day_name, order)')
      .eq('course_id', otherCourse).order('order', { ascending: true })
      .then(({ data }) => {
        const mods = (data ?? []).filter((m: OtherModule) => m.title && !m.title.includes('DO NOT PUBLISH'))
        setOtherModules(mods); setOtherModule(mods[0]?.id ?? ''); setLoadingModules(false)
      })
  }, [otherCourse])

  const sameDays = (() => {
    const existing = weekModules.find(m => m.id === sameModule)?.days ?? []
    const extra = existing.filter(d => !DAY_OPTIONS.includes(d) && !SKIP_DAYS.has(d))
    return [...new Set([...extra, ...DAY_OPTIONS])]
  })()

  const otherDays = (() => {
    const existing = (otherModules.find(m => m.id === otherModule)?.module_days ?? []).map(d => d.day_name)
    const extra = existing.filter(d => !DAY_OPTIONS.includes(d) && !SKIP_DAYS.has(d))
    return [...new Set([...extra, ...DAY_OPTIONS])]
  })()

  async function handleCopy() {
    setError(null); setCopying(true)

    let targetCourseId: string
    let targetModuleTitle: string
    let targetDayTitle: string

    if (tab === 'same') {
      if (!sameModule || !sameDay) { setError('Pick a module and day'); setCopying(false); return }
      targetCourseId = currentCourseId
      targetModuleTitle = weekModules.find(m => m.id === sameModule)?.title ?? ''
      targetDayTitle = sameDay
    } else {
      if (!otherCourse || !otherModule || !otherDay) { setError('Pick a course, module, and day'); setCopying(false); return }
      targetCourseId = otherCourse
      targetModuleTitle = otherModules.find(m => m.id === otherModule)?.title ?? ''
      targetDayTitle = otherDay
    }

    const { data: newQ, error: e } = await supabase.from('quizzes').insert({
      course_id: targetCourseId,
      title: quiz.title,
      questions: quiz.questions,
      published: false,
      module_title: targetModuleTitle,
      day_title: targetDayTitle,
    }).select().single()
    setCopying(false)
    if (e || !newQ) { setError(e?.message ?? 'Failed to copy'); return }
    if (tab === 'same') onDuplicatedInCourse(newQ as DuplicatedQuiz)
    setSuccess(true)
    setTimeout(onClose, 800)
  }

  return (
    <div ref={popupRef} className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-3 flex flex-col gap-2"
      style={{ top: popupPos.top, left: popupPos.left, width: 300, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}>
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Copy quiz</p>
      <div className="flex gap-1">
        {(['same', 'other'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); setError(null) }}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${tab === t ? 'bg-teal-primary text-white border-teal-primary' : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'}`}>
            {t === 'same' ? 'This course' : 'Another course'}
          </button>
        ))}
      </div>
      {tab === 'same' ? (
        <>
          <select value={sameModule} onChange={e => { setSameModule(e.target.value); setSameDay('') }}
            className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
            {weekModules.map(m => <option key={m.id} value={m.id}>{m.title ?? (m.week != null ? `Week ${m.week}` : 'Unassigned')}</option>)}
          </select>
          <DayPicker days={sameDays} selected={sameDay} onSelect={setSameDay} />
        </>
      ) : (
        <>
          {loadingCourses ? <p className="text-xs text-muted-text">Loading courses…</p> : (
            <select value={otherCourse} onChange={e => setOtherCourse(e.target.value)}
              className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
              <option value="">— Select a course —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {otherCourse && (loadingModules ? <p className="text-xs text-muted-text">Loading modules…</p> : (
            <>
              <select value={otherModule} onChange={e => { setOtherModule(e.target.value); setOtherDay('') }}
                className="text-xs bg-background border border-border rounded px-2 py-1 text-dark-text w-full focus:outline-none focus:ring-1 focus:ring-teal-primary">
                <option value="">— Select module —</option>
                {otherModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              {otherModule && <DayPicker days={otherDays} selected={otherDay} onSelect={setOtherDay} />}
            </>
          ))}
        </>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-teal-primary font-medium">Copied!</p>}
      <button type="button" onClick={handleCopy}
        disabled={copying || success || (tab === 'same' ? !sameModule || !sameDay : !otherCourse || !otherModule || !otherDay)}
        className="text-xs bg-teal-primary text-white rounded-lg py-1.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
        {copying ? 'Copying…' : success ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  )
}

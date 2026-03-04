'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import HtmlContent from '@/components/ui/HtmlContent'
import DailySchedule from '@/components/ui/DailySchedule'
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SectionType = 'text' | 'daily_schedule' | 'course_outline' | 'yearly_schedule'

export type CourseSection = {
  id: string
  title: string
  content: string | null
  order: number
  type: SectionType
}

type OutlineRow = { week: number; topics: string; description: string }
type Cohort = { name: string; start: string; end: string }
type BreakPeriod = { label: string; start: string; end: string }
type YearlyData = { cohorts: Cohort[]; breaks: BreakPeriod[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline [&_strong]:font-semibold
  [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3
  [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-text [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-border
  [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-border [&_td]:align-top`

function parseOutline(content: string | null): OutlineRow[] {
  try { return (JSON.parse(content ?? '').rows as OutlineRow[]) } catch {}
  return Array.from({ length: 15 }, (_, i) => ({ week: i + 1, topics: '', description: '' }))
}

function parseYearly(content: string | null): YearlyData {
  try { return JSON.parse(content ?? '') as YearlyData } catch {}
  return {
    cohorts: [
      { name: 'Winter/Spring', start: '', end: '' },
      { name: 'Summer', start: '', end: '' },
      { name: 'Fall', start: '', end: '' },
    ],
    breaks: [
      { label: 'Spring Break', start: '', end: '' },
      { label: 'Summer Break', start: '', end: '' },
      { label: 'Winter Break', start: '', end: '' },
    ],
  }
}

function formatDate(d: string): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4" cy="3" r="1.2" /><circle cx="10" cy="3" r="1.2" />
      <circle cx="4" cy="7" r="1.2" /><circle cx="10" cy="7" r="1.2" />
      <circle cx="4" cy="11" r="1.2" /><circle cx="10" cy="11" r="1.2" />
    </svg>
  )
}

// ── Read-only section content (shared with student view) ──────────────────────

export function CourseOutlineView({ content }: { content: string | null }) {
  const rows = parseOutline(content)
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[56px_1fr_1.5fr] bg-teal-light/60 border-b border-border">
        <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Week</div>
        <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Topics Covered</div>
        <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Description</div>
      </div>
      {rows.map(row => (
        <div key={row.week} className="grid grid-cols-[56px_1fr_1.5fr] border-b border-border last:border-b-0">
          <div className="px-3 py-2 text-sm text-muted-text font-medium">{row.week}</div>
          <div className="px-3 py-2 text-sm text-dark-text">{row.topics || <span className="text-muted-text/40">—</span>}</div>
          <div className="px-3 py-2 text-sm text-dark-text">{row.description || <span className="text-muted-text/40">—</span>}</div>
        </div>
      ))}
    </div>
  )
}

export function YearlyScheduleView({ content }: { content: string | null }) {
  const { cohorts, breaks } = parseYearly(content)
  // Interleave: C1, Break1, C2, Break2, C3, Break3
  const rows: { label: string; start: string; end: string; kind: 'cohort' | 'break' }[] = []
  const maxLen = Math.max(cohorts.length, breaks.length)
  for (let i = 0; i < maxLen; i++) {
    if (cohorts[i]) rows.push({ label: cohorts[i].name, start: cohorts[i].start, end: cohorts[i].end, kind: 'cohort' })
    if (breaks[i]) rows.push({ label: breaks[i].label, start: breaks[i].start, end: breaks[i].end, kind: 'break' })
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_1fr] bg-teal-light/60 border-b border-border">
        <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Period</div>
        <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Start</div>
        <div className="px-4 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">End</div>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid grid-cols-[1fr_1fr_1fr] border-b border-border last:border-b-0 ${
            row.kind === 'cohort' ? 'bg-teal-light/30' : 'bg-amber-50'
          }`}
        >
          <div className={`px-4 py-2.5 text-sm font-medium ${row.kind === 'cohort' ? 'text-teal-primary' : 'text-amber-700'}`}>
            {row.label || '—'}
          </div>
          <div className="px-4 py-2.5 text-sm text-dark-text">{formatDate(row.start)}</div>
          <div className="px-4 py-2.5 text-sm text-dark-text">{formatDate(row.end)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Course Outline editable card ──────────────────────────────────────────────

function CourseOutlineCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging,
  onUpdate, onDelete,
}: {
  section: CourseSection
  dragListeners: object; dragAttributes: object; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<OutlineRow[]>(() => parseOutline(section.content))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onUpdate({ content: JSON.stringify({ rows }) })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="font-semibold text-dark-text">{section.title}</h3>
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-muted-text hover:text-teal-primary transition-colors">✎ Edit</button>
            )}
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-[48px_1fr_1.5fr] bg-teal-light/60 border-b border-border">
                <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Week</div>
                <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Topics Covered</div>
                <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Description</div>
              </div>
              {rows.map((row, i) => (
                <div key={row.week} className="grid grid-cols-[48px_1fr_1.5fr] border-b border-border last:border-b-0">
                  <div className="px-3 py-2 text-sm text-muted-text font-medium flex items-center">{row.week}</div>
                  <div className="px-1 py-1 border-r border-border">
                    <input
                      value={row.topics}
                      onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, topics: e.target.value } : r))}
                      className="w-full px-2 py-1.5 text-sm text-dark-text bg-transparent focus:outline-none focus:bg-background rounded"
                      placeholder="Topics…"
                    />
                  </div>
                  <div className="px-1 py-1">
                    <input
                      value={row.description}
                      onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
                      className="w-full px-2 py-1.5 text-sm text-dark-text bg-transparent focus:outline-none focus:bg-background rounded"
                      placeholder="Description…"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setRows(parseOutline(section.content)); setEditing(false) }} className="text-sm text-muted-text hover:text-dark-text transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <CourseOutlineView content={section.content} />
        )}
      </div>
    </div>
  )
}

// ── Yearly Schedule editable card ─────────────────────────────────────────────

function YearlyScheduleCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging,
  onUpdate, onDelete,
}: {
  section: CourseSection
  dragListeners: object; dragAttributes: object; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [data, setData] = useState<YearlyData>(() => parseYearly(section.content))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const setCohort = (i: number, field: keyof Cohort, val: string) =>
    setData(prev => ({ ...prev, cohorts: prev.cohorts.map((c, j) => j === i ? { ...c, [field]: val } : c) }))

  const setBreak = (i: number, field: keyof BreakPeriod, val: string) =>
    setData(prev => ({ ...prev, breaks: prev.breaks.map((b, j) => j === i ? { ...b, [field]: val } : b) }))

  const handleSave = async () => {
    setSaving(true)
    await onUpdate({ content: JSON.stringify(data) })
    setSaving(false)
    setEditing(false)
  }

  const inputCls = "w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"

  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="font-semibold text-dark-text">{section.title}</h3>
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-muted-text hover:text-teal-primary transition-colors">✎ Edit</button>
            )}
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Cohorts</p>
              <div className="flex flex-col gap-2">
                {data.cohorts.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-2">
                    <input value={c.name} onChange={e => setCohort(i, 'name', e.target.value)} placeholder="Name" className={inputCls} />
                    <input type="date" value={c.start} onChange={e => setCohort(i, 'start', e.target.value)} className={inputCls} />
                    <input type="date" value={c.end} onChange={e => setCohort(i, 'end', e.target.value)} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Breaks</p>
              <div className="flex flex-col gap-2">
                {data.breaks.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-2">
                    <input value={b.label} onChange={e => setBreak(i, 'label', e.target.value)} placeholder="Label (e.g. Spring Break)" className={inputCls} />
                    <input type="date" value={b.start} onChange={e => setBreak(i, 'start', e.target.value)} className={inputCls} />
                    <input type="date" value={b.end} onChange={e => setBreak(i, 'end', e.target.value)} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setData(parseYearly(section.content)); setEditing(false) }} className="text-sm text-muted-text hover:text-dark-text transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <YearlyScheduleView content={section.content} />
        )}
      </div>
    </div>
  )
}

// ── Daily Schedule card (drag-only, no content editing) ───────────────────────

function DailyScheduleCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging, onDelete,
}: {
  section: CourseSection
  dragListeners: object; dragAttributes: object; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onDelete: () => Promise<void>
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-semibold text-dark-text">{section.title}</h3>
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>
        </div>
        <DailySchedule />
      </div>
    </div>
  )
}

// ── Text section card ─────────────────────────────────────────────────────────

function TextSectionCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging,
  onUpdate, onDelete,
}: {
  section: CourseSection
  dragListeners: object; dragAttributes: object; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onUpdate({ title: title.trim() || section.title, content: content || null })
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(section.title)
    setContent(section.content ?? '')
    setEditing(false)
    setConfirmDelete(false)
  }

  if (editing) {
    return (
      <div ref={dragRef} style={dragStyle} className="bg-surface rounded-2xl border border-teal-primary p-5 flex gap-3">
        <div className="shrink-0 mt-1 w-3.5" /> {/* placeholder for grip width */}
        <div className="flex-1 flex flex-col gap-4">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Section title"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-semibold text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
          <div className="border border-border rounded-xl overflow-hidden">
            <RichTextEditor content={content} onChange={setContent} placeholder="Add content…" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={handleCancel} className="text-sm text-muted-text hover:text-dark-text transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-semibold text-dark-text">{section.title}</h3>
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs text-muted-text hover:text-teal-primary transition-colors">✎ Edit</button>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>
        </div>
        {section.content
          ? <HtmlContent html={section.content} className={HTML_CLASSES} />
          : <button onClick={() => setEditing(true)} className="text-sm text-muted-text hover:text-teal-primary italic transition-colors">+ Add content</button>
        }
      </div>
    </div>
  )
}

// ── Unified SectionCard (routes to correct sub-component) ─────────────────────

function SectionCard({ section, onUpdate, onDelete }: {
  section: CourseSection
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const shared = { dragListeners: listeners, dragAttributes: attributes, dragRef: setNodeRef, dragStyle: style, dragIsDragging: isDragging }

  if (section.type === 'daily_schedule') return <DailyScheduleCard section={section} {...shared} onDelete={onDelete} />
  if (section.type === 'course_outline') return <CourseOutlineCard section={section} {...shared} onUpdate={onUpdate} onDelete={onDelete} />
  if (section.type === 'yearly_schedule') return <YearlyScheduleCard section={section} {...shared} onUpdate={onUpdate} onDelete={onDelete} />
  return <TextSectionCard section={section} {...shared} onUpdate={onUpdate} onDelete={onDelete} />
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GeneralInfoEditor({ courseId, initialSections }: {
  courseId: string
  initialSections: CourseSection[]
}) {
  const supabase = createClient()
  const [sections, setSections] = useState<CourseSection[]>(
    [...initialSections].sort((a, b) => a.order - b.order)
  )
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex(s => s.id === active.id)
    const newIndex = sections.findIndex(s => s.id === over.id)
    const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }))
    setSections(reordered)
    await Promise.all(reordered.map(s => supabase.from('course_sections').update({ order: s.order }).eq('id', s.id)))
  }

  const addSection = async () => {
    if (!newTitle.trim()) return
    setAddSaving(true)
    setAddError('')
    const { data, error } = await supabase
      .from('course_sections')
      .insert({ course_id: courseId, title: newTitle.trim(), content: null, order: sections.length, type: 'text' })
      .select().single()
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    if (data) { setSections(prev => [...prev, data as CourseSection]); setNewTitle(''); setAdding(false) }
  }

  const updateSection = async (id: string, updates: Partial<CourseSection>) => {
    await supabase.from('course_sections').update(updates).eq('id', id)
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const deleteSection = async (id: string) => {
    await supabase.from('course_sections').delete().eq('id', id)
    setSections(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext id="general-info-sections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              onUpdate={updates => updateSection(section.id, updates)}
              onDelete={() => deleteSection(section.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && !adding && (
        <p className="text-sm text-muted-text mb-1">No sections yet.</p>
      )}

      {adding ? (
        <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Section title (e.g. Additional Resources…)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') addSection() }}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
          <div className="flex items-center gap-3">
            <button onClick={addSection} disabled={!newTitle.trim() || addSaving} className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity">
              {addSaving ? 'Adding…' : 'Add section'}
            </button>
            <button onClick={() => { setAdding(false); setNewTitle(''); setAddError('') }} className="text-sm text-muted-text hover:text-dark-text transition-colors">Cancel</button>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 text-sm text-teal-primary font-medium hover:underline py-1 self-start">
          + Add section
        </button>
      )}
    </div>
  )
}

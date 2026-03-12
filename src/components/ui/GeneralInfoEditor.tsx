'use client'
import { useState, createContext, useContext } from 'react'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'

const ReadOnlyCtx = createContext(false)
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import HtmlContent from '@/components/ui/HtmlContent'
import DailySchedule from '@/components/ui/DailySchedule'
import YearlyScheduleSection from '@/components/ui/YearlyScheduleSection'
import GlobalContentSection from '@/components/ui/GlobalContentSection'
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, type DraggableAttributes,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SectionType = string

export type CourseSection = {
  id: string
  title: string
  content: string | null
  order: number
  type: SectionType
  published: boolean
}

function PublishToggle({ published, onToggle }: { published: boolean; onToggle: () => void }) {
  return published ? (
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-medium text-teal-primary">✓ Published</span>
      <button onClick={onToggle} className="text-xs text-muted-text hover:text-dark-text transition-colors">Unpublish</button>
    </span>
  ) : (
    <button onClick={onToggle} className="shrink-0 text-xs font-semibold text-teal-primary border border-teal-primary/40 px-2.5 py-0.5 rounded-full hover:bg-teal-primary/10 transition-colors">
      Publish
    </button>
  )
}

type OutlineRow = { week: number; topics: string; description: string }

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

function toSlug(title: string): string {
  const slug = title.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return slug || `section-${Date.now()}`
}

function parseOutline(content: string | null): OutlineRow[] {
  try { return (JSON.parse(content ?? '').rows as OutlineRow[]) } catch {}
  return Array.from({ length: 15 }, (_, i) => ({ week: i + 1, topics: '', description: '' }))
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

function getCurrentWeek(startDate: string | null | undefined): number | null {
  if (!startDate) return null
  const start = new Date(startDate)
  const today = new Date()
  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1
}

export function CourseOutlineView({ content, courseStartDate }: { content: string | null; courseStartDate?: string | null }) {
  const rows = parseOutline(content)
  const currentWeek = getCurrentWeek(courseStartDate)
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[88px_1fr_1.5fr] bg-teal-light/60 border-b border-border">
        <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Week</div>
        <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Topics Covered</div>
        <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Description</div>
      </div>
      {rows.map(row => {
        const isCurrent = currentWeek === row.week
        return (
          <div key={row.week} className={`grid grid-cols-[88px_1fr_1.5fr] border-b border-border last:border-b-0 ${isCurrent ? 'bg-teal-light/10' : ''}`}>
            <div className="px-3 py-2 text-sm text-muted-text font-medium">
              Week {row.week}
            </div>
            <div className="px-3 py-2 text-sm text-dark-text min-w-0 break-words">{row.topics || <span className="text-muted-text/40">—</span>}</div>
            <div className="px-3 py-2 text-sm text-dark-text min-w-0 break-words">{row.description || <span className="text-muted-text/40">—</span>}</div>
          </div>
        )
      })}
    </div>
  )
}


// ── Course Outline editable card ──────────────────────────────────────────────

function CourseOutlineCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging,
  onUpdate, onDelete, onTogglePublish,
}: {
  section: CourseSection
  dragListeners: object | undefined; dragAttributes: DraggableAttributes; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
  onTogglePublish: () => void
}) {
  const readOnly = useContext(ReadOnlyCtx)
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<OutlineRow[]>(() => parseOutline(section.content))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useUnsavedChanges(editing)

  const handleSave = async () => {
    setSaving(true)
    await onUpdate({ content: JSON.stringify({ rows }) })
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setRows(parseOutline(section.content))
    setEditing(false)
  }

  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      {!readOnly && <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold text-dark-text flex-1">{section.title}</h3>
          {!readOnly && <PublishToggle published={section.published} onToggle={onTogglePublish} />}
          {!readOnly && (
            <div className={`flex items-center gap-3 shrink-0 transition-opacity ${editing ? '' : 'opacity-0 group-hover:opacity-100'}`}>
              {editing ? (
                <>
                  <button onClick={handleSave} disabled={saving} className="text-xs font-semibold text-teal-primary hover:opacity-70 disabled:opacity-40 transition-opacity">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={handleCancel} className="text-xs text-muted-text hover:text-dark-text transition-colors">Cancel</button>
                </>
              ) : null}
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
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className={`grid bg-teal-light/60 border-b border-border ${editing ? 'grid-cols-[88px_1fr_1.5fr_28px]' : 'grid-cols-[88px_1fr_1.5fr]'}`}>
              <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Week</div>
              <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Topics Covered</div>
              <div className="px-3 py-2 text-xs font-bold text-dark-text uppercase tracking-wide">Description</div>
              {editing && <div />}
            </div>
            {rows.map((row, i) => (
              <div key={i} className={`grid border-b border-border last:border-b-0 ${editing ? 'grid-cols-[88px_1fr_1.5fr_28px]' : 'grid-cols-[88px_1fr_1.5fr]'}`}>
                <div className="px-3 py-2 text-sm text-muted-text font-medium flex items-start pt-3">Week {row.week}</div>
                <div className="px-1 py-1 border-r border-border">
                  <textarea
                    value={row.topics}
                    onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, topics: e.target.value } : r))}
                    onFocus={() => !readOnly && setEditing(true)}
                    rows={2}
                    readOnly={readOnly}
                    placeholder={editing ? 'Topics…' : ''}
                    className={`w-full px-2 py-1.5 text-sm text-dark-text bg-transparent focus:outline-none rounded resize-none ${
                      editing ? 'focus:bg-background resize-y cursor-text' : 'cursor-pointer hover:bg-teal-light/20'
                    } ${readOnly ? 'cursor-default' : ''}`}
                  />
                </div>
                <div className="px-1 py-1">
                  <textarea
                    value={row.description}
                    onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
                    onFocus={() => !readOnly && setEditing(true)}
                    rows={2}
                    readOnly={readOnly}
                    placeholder={editing ? 'Description…' : ''}
                    className={`w-full px-2 py-1.5 text-sm text-dark-text bg-transparent focus:outline-none rounded resize-none ${
                      editing ? 'focus:bg-background resize-y cursor-text' : 'cursor-pointer hover:bg-teal-light/20'
                    } ${readOnly ? 'cursor-default' : ''}`}
                  />
                </div>
                {editing && (
                  <div className="flex items-start pt-2.5 pr-1">
                    <button
                      type="button"
                      onClick={() => setRows(prev => prev.filter((_, j) => j !== i).map((r, j) => ({ ...r, week: j + 1 })))}
                      className="text-border hover:text-red-400 transition-colors p-0.5"
                      aria-label="Remove row"
                    ><svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <button
              type="button"
              onClick={() => setRows(prev => [...prev, { week: prev.length + 1, topics: '', description: '' }])}
              className="text-sm text-teal-primary font-medium hover:underline self-start"
            >
              + Add row
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Yearly Schedule card (reads from global calendar tables) ──────────────────

function YearlyScheduleGlobalCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging, onDelete, onTogglePublish,
}: {
  section: CourseSection
  dragListeners: object | undefined; dragAttributes: DraggableAttributes; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onDelete: () => Promise<void>
  onTogglePublish: () => void
}) {
  const readOnly = useContext(ReadOnlyCtx)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      {!readOnly && <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold text-dark-text flex-1">{section.title}</h3>
          {!readOnly && <PublishToggle published={section.published} onToggle={onTogglePublish} />}
          {!readOnly && <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <a href="/instructor/calendar" className="text-xs text-muted-text hover:text-teal-primary transition-colors">
              ✎ Manage calendar
            </a>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>}
        </div>
        <YearlyScheduleSection instructorEditHref="/instructor/calendar" />
      </div>
    </div>
  )
}

// ── Daily Schedule card (drag-only, no content editing) ───────────────────────

function DailyScheduleCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging, onDelete, onTogglePublish,
}: {
  section: CourseSection
  dragListeners: object | undefined; dragAttributes: DraggableAttributes; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onDelete: () => Promise<void>
  onTogglePublish: () => void
}) {
  const readOnly = useContext(ReadOnlyCtx)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      {!readOnly && <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-semibold text-dark-text flex-1">{section.title}</h3>
          {!readOnly && <PublishToggle published={section.published} onToggle={onTogglePublish} />}
          {!readOnly && <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>}
        </div>
        <DailySchedule />
      </div>
    </div>
  )
}

// ── Global content card (Computer & Wifi, Policies) ───────────────────────────

function GlobalTextCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging,
  onDelete, onTogglePublish, onRemoveGlobal, slug, editHref,
}: {
  section: CourseSection
  dragListeners: object | undefined; dragAttributes: DraggableAttributes; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onDelete: () => Promise<void>
  onTogglePublish: () => void
  onRemoveGlobal?: () => Promise<void>
  slug: string
  editHref: string
}) {
  const readOnly = useContext(ReadOnlyCtx)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleRemoveGlobal = async () => {
    if (!onRemoveGlobal) return
    setRemoving(true)
    await onRemoveGlobal()
    // card re-renders as TextSectionCard after type change
  }

  return (
    <div ref={dragRef} style={dragStyle} className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${dragIsDragging ? 'opacity-50 shadow-lg' : ''}`}>
      {!readOnly && <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="font-semibold text-dark-text flex-1">{section.title}</h3>
          {!readOnly && <PublishToggle published={section.published} onToggle={onTogglePublish} />}
          {!readOnly && <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <a href={editHref} className="text-xs text-muted-text hover:text-teal-primary transition-colors">
              ✎ Edit globally
            </a>
            {onRemoveGlobal && (
              <button
                onClick={handleRemoveGlobal}
                disabled={removing}
                title="Copy this global template into a course-specific version you can edit freely"
                className="text-xs text-muted-text hover:text-amber-600 transition-colors disabled:opacity-50"
              >
                {removing ? 'Copying…' : '⎇ Customize for this course'}
              </button>
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
          </div>}
        </div>
        <GlobalContentSection slug={slug} />
      </div>
    </div>
  )
}

// ── Text section card ─────────────────────────────────────────────────────────

function TextSectionCard({
  section, dragListeners, dragAttributes, dragRef, dragStyle, dragIsDragging,
  onUpdate, onDelete, onTogglePublish, onToggleCollapse,
}: {
  section: CourseSection
  dragListeners: object | undefined; dragAttributes: DraggableAttributes; dragRef: (el: HTMLElement | null) => void
  dragStyle: React.CSSProperties; dragIsDragging: boolean
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
  onTogglePublish: () => void
  onToggleCollapse?: () => void
}) {
  const readOnly = useContext(ReadOnlyCtx)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(section.title)
  const [content, setContent] = useState(section.content ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [making, setMaking] = useState(false)
  useUnsavedChanges(editing)

  const handleMakeGlobal = async () => {
    setMaking(true)
    const slug = toSlug(section.title)
    await createClient().from('global_content').upsert({ slug, title: section.title, content: section.content ?? '' })
    await onUpdate({ type: `global:${slug}` })
    window.dispatchEvent(new CustomEvent('global-content-changed'))
    // card re-renders as GlobalTextCard after type change
  }

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
      {!readOnly && <button {...dragAttributes} {...dragListeners} className="shrink-0 mt-1 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none" tabIndex={-1} aria-label="Drag to reorder">
        <GripIcon />
      </button>}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-3">
          <h3 className="font-semibold text-dark-text flex-1">{section.title}</h3>
          {!readOnly && <PublishToggle published={section.published} onToggle={onTogglePublish} />}
          {!readOnly && <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs text-muted-text hover:text-teal-primary transition-colors">✎ Edit</button>
            <button
              onClick={handleMakeGlobal}
              disabled={making}
              title="Share this section across all courses as a global template"
              className="text-xs text-muted-text hover:text-teal-primary transition-colors disabled:opacity-50"
            >
              {making ? 'Saving…' : '⊕ Make global'}
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-text hover:text-red-500 transition-colors">Delete</button>
            )}
          </div>}
        </div>
        {section.content
          ? <HtmlContent html={section.content} className={HTML_CLASSES} />
          : !readOnly && <button onClick={() => setEditing(true)} className="text-sm text-muted-text hover:text-teal-primary italic transition-colors">+ Add content</button>
        }
      </div>
    </div>
  )
}

// ── Unified SectionCard (routes to correct sub-component) ─────────────────────

function SectionCard({ section, courseId, collapsed, onToggleCollapse, onUpdate, onDelete, onTogglePublish, onRemoveGlobal }: {
  section: CourseSection
  courseId: string
  collapsed: boolean
  onToggleCollapse: () => void
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
  onTogglePublish: () => void
  onRemoveGlobal?: () => Promise<void>
}) {
  const readOnly = useContext(ReadOnlyCtx)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  if (collapsed) {
    return (
      <div ref={setNodeRef} style={style} className={`bg-surface rounded-2xl border border-border px-5 py-3.5 flex items-center gap-3 ${isDragging ? 'opacity-50' : ''}`}>
        {!readOnly && <button {...attributes} {...listeners} className="shrink-0 text-border hover:text-muted-text cursor-grab active:cursor-grabbing touch-none" tabIndex={-1} aria-label="Drag to reorder">
          <GripIcon />
        </button>}
        <button type="button" onClick={onToggleCollapse} className="flex-1 flex items-center justify-between text-left gap-2">
          <h3 className="font-semibold text-dark-text">{section.title}</h3>
          <span className="text-xs text-muted-text">▾</span>
        </button>
        {!readOnly && <PublishToggle published={section.published} onToggle={onTogglePublish} />}
      </div>
    )
  }

  const shared = { dragListeners: listeners, dragAttributes: attributes, dragRef: setNodeRef, dragStyle: style, dragIsDragging: isDragging, onTogglePublish, onToggleCollapse }

  if (section.type === 'daily_schedule') return <DailyScheduleCard section={section} {...shared} onDelete={onDelete} />
  if (section.type === 'course_outline') return <CourseOutlineCard section={section} {...shared} onUpdate={onUpdate} onDelete={onDelete} />
  if (section.type === 'yearly_schedule') return <YearlyScheduleGlobalCard section={section} {...shared} onDelete={onDelete} />
  if (section.type === 'computer_wifi') return <GlobalTextCard section={section} {...shared} onDelete={onDelete} slug="computer-wifi" editHref={`/instructor/globals/computer-wifi?from=${courseId}`} />
  if (section.type === 'policies_procedures') return <GlobalTextCard section={section} {...shared} onDelete={onDelete} slug="policies" editHref={`/instructor/globals/policies?from=${courseId}`} />
  if (section.type?.startsWith('global:')) {
    const slug = section.type.slice(7)
    return <GlobalTextCard section={section} {...shared} onDelete={onDelete} onRemoveGlobal={onRemoveGlobal} slug={slug} editHref={`/instructor/globals/${slug}?from=${courseId}`} />
  }
  return <TextSectionCard section={section} {...shared} onUpdate={onUpdate} onDelete={onDelete} />
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function GeneralInfoEditor({ courseId, initialSections, readOnly = false }: {
  courseId: string
  initialSections: CourseSection[]
  readOnly?: boolean
}) {
  const supabase = createClient()
  const [sections, setSections] = useState<CourseSection[]>(
    [...initialSections].sort((a, b) => a.order - b.order)
  )
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const toggleCollapse = (id: string) => setCollapsedSections(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const expandAll = () => setCollapsedSections(new Set())
  const collapseAll = () => setCollapsedSections(new Set(sections.map(s => s.id)))

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

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from('course_sections').update({ published: !current }).eq('id', id)
    setSections(prev => prev.map(s => s.id === id ? { ...s, published: !current } : s))
  }

  const removeGlobal = async (section: CourseSection) => {
    const slug = section.type.slice(7)
    // Fetch the current global content to copy it locally — do NOT delete the global template
    const { data: globalRow } = await supabase.from('global_content').select('content').eq('slug', slug).single()
    await updateSection(section.id, { type: 'text', content: globalRow?.content ?? section.content })
    // No dispatchEvent — the global template still exists, nav stays the same
  }

  return (
    <ReadOnlyCtx.Provider value={readOnly}>
    <div className="flex flex-col gap-3">
      {sections.length > 1 && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={expandAll} className="text-xs text-muted-text hover:text-dark-text transition-colors">Expand all</button>
          <span className="text-xs text-border">·</span>
          <button type="button" onClick={collapseAll} className="text-xs text-muted-text hover:text-dark-text transition-colors">Collapse all</button>
        </div>
      )}
      <DndContext id="general-info-sections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              courseId={courseId}
              collapsed={collapsedSections.has(section.id)}
              onToggleCollapse={() => toggleCollapse(section.id)}
              onUpdate={updates => updateSection(section.id, updates)}
              onDelete={() => deleteSection(section.id)}
              onTogglePublish={() => togglePublish(section.id, section.published)}
              onRemoveGlobal={section.type?.startsWith('global:') ? () => removeGlobal(section) : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>

      {sections.length === 0 && !adding && (
        <p className="text-sm text-muted-text mb-1">No sections yet.</p>
      )}

      {!readOnly && (adding ? (
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
      ))}
    </div>
    </ReadOnlyCtx.Provider>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import HtmlContent from '@/components/ui/HtmlContent'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
  [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline
  [&_strong]:font-semibold
  [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3
  [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-text [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-border
  [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-border [&_td]:align-top`

export type CourseSection = {
  id: string
  title: string
  content: string | null
  order: number
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4" cy="3" r="1.2" /><circle cx="10" cy="3" r="1.2" />
      <circle cx="4" cy="7" r="1.2" /><circle cx="10" cy="7" r="1.2" />
      <circle cx="4" cy="11" r="1.2" /><circle cx="10" cy="11" r="1.2" />
    </svg>
  )
}

function SectionCard({
  section,
  onUpdate,
  onDelete,
}: {
  section: CourseSection
  onUpdate: (updates: Partial<CourseSection>) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

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
      <div ref={setNodeRef} style={style} className="bg-surface rounded-2xl border border-teal-primary p-5 flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Section title"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-semibold text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
        <div className="border border-border rounded-xl overflow-hidden">
          <RichTextEditor content={content} onChange={setContent} placeholder="Add content for this section…" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={handleCancel} className="text-sm text-muted-text hover:text-dark-text transition-colors">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface rounded-2xl border border-border p-5 group flex gap-3 ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 mt-0.5 text-border hover:text-muted-text cursor-grab active:cursor-grabbing transition-colors touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-semibold text-dark-text">{section.title}</h3>
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted-text hover:text-teal-primary transition-colors"
            >
              ✎ Edit
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-text">Delete?</span>
                <button onClick={() => onDelete()} className="text-red-500 font-medium hover:underline">Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-muted-text hover:text-dark-text">No</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-muted-text hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {section.content ? (
          <HtmlContent html={section.content} className={HTML_CLASSES} />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-muted-text hover:text-teal-primary italic transition-colors"
          >
            + Add content
          </button>
        )}
      </div>
    </div>
  )
}

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

    await Promise.all(
      reordered.map(s => supabase.from('course_sections').update({ order: s.order }).eq('id', s.id))
    )
  }

  const addSection = async () => {
    if (!newTitle.trim()) return
    setAddSaving(true)
    setAddError('')
    const order = sections.length
    const { data, error } = await supabase
      .from('course_sections')
      .insert({ course_id: courseId, title: newTitle.trim(), content: null, order })
      .select()
      .single()
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    if (data) {
      setSections(prev => [...prev, data as CourseSection])
      setNewTitle('')
      setAdding(false)
    }
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
        <p className="text-sm text-muted-text mb-1">No sections yet. Add your first one below.</p>
      )}

      {adding ? (
        <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Section title (e.g. Daily Schedule, About Your Instructors…)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') addSection() }}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={addSection}
              disabled={!newTitle.trim() || addSaving}
              className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {addSaving ? 'Adding…' : 'Add section'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewTitle(''); setAddError('') }}
              className="text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
          {addError && <p className="text-xs text-red-500">{addError}</p>}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-teal-primary font-medium hover:underline py-1 self-start"
        >
          + Add section
        </button>
      )}
    </div>
  )
}

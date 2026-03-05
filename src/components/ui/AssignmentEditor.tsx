'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from './RichTextEditor'
import Link from 'next/link'

interface ChecklistItem {
  id: string
  text: string
  description: string | null
  order: number
}

interface Props {
  courseId: string
  assignment: {
    id: string
    title: string
    description: string | null
    how_to_turn_in: string | null
    due_date: string | null
    published: boolean
  }
  initialChecklist: ChecklistItem[]
}

export default function AssignmentEditor({ courseId, assignment, initialChecklist }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [title, setTitle] = useState(assignment.title)
  const [description, setDescription] = useState(assignment.description ?? '')
  const [howToTurnIn, setHowToTurnIn] = useState(assignment.how_to_turn_in ?? '')
  const [dueDate, setDueDate] = useState(
    assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : ''
  )
  const [published, setPublished] = useState(assignment.published)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist)
  const [newItemText, setNewItemText] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('assignments')
      .update({
        title,
        description: description || null,
        how_to_turn_in: howToTurnIn || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        published,
      })
      .eq('id', assignment.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const addChecklistItem = async () => {
    if (!newItemText.trim()) return
    const nextOrder = checklist.length > 0 ? Math.max(...checklist.map(i => i.order)) + 1 : 0
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ assignment_id: assignment.id, text: newItemText.trim(), description: newItemDesc.trim() || null, order: nextOrder })
      .select('id, text, description, order')
      .single()
    if (error) { alert(error.message); return }
    setChecklist(prev => [...prev, data])
    setNewItemText('')
    setNewItemDesc('')
  }

  const deleteChecklistItem = async (id: string) => {
    if (!window.confirm('Delete this checklist item?')) return
    const { error } = await supabase.from('checklist_items').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setChecklist(prev => prev.filter(i => i.id !== id))
  }

  const updateChecklistItem = async (item: ChecklistItem, text: string, desc: string) => {
    const { error } = await supabase
      .from('checklist_items')
      .update({ text, description: desc || null })
      .eq('id', item.id)
    if (error) { alert(error.message); return }
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, text, description: desc || null } : i))
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Title + Published */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
          />
        </div>
        <div className="pt-6">
          <button
            type="button"
            onClick={() => setPublished(p => !p)}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-colors ${
              published
                ? 'bg-teal-light text-teal-primary border-teal-primary/30'
                : 'bg-background text-muted-text border-border'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${published ? 'bg-teal-primary' : 'bg-muted-text'}`} />
            {published ? 'Published' : 'Draft'}
          </button>
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Due Date</label>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Instructions</label>
        <RichTextEditor content={description} onChange={setDescription} placeholder="Assignment instructions…" />
      </div>

      {/* How to turn in */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">How to Turn In</label>
        <RichTextEditor content={howToTurnIn} onChange={setHowToTurnIn} placeholder="How students should submit this assignment…" />
      </div>

      {/* Checklist */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">Grading Checklist</label>
        <div className="flex flex-col gap-2 mb-4">
          {checklist.sort((a, b) => a.order - b.order).map(item => (
            <ChecklistItemRow key={item.id} item={item} onDelete={deleteChecklistItem} onUpdate={updateChecklistItem} />
          ))}
        </div>
        {/* Add new item */}
        <div className="bg-surface rounded-xl border border-dashed border-border p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Add Item</p>
          <input
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
            placeholder="Item text…"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
          />
          <input
            value={newItemDesc}
            onChange={e => setNewItemDesc(e.target.value)}
            placeholder="Description (optional)…"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
          />
          <button
            type="button"
            onClick={addChecklistItem}
            disabled={!newItemText.trim()}
            className="self-start px-4 py-1.5 text-sm bg-teal-primary text-white rounded-lg hover:bg-teal-600 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4 pb-12">
        <button
          type="button"
          onClick={save}
          disabled={saving || !title.trim()}
          className="px-6 py-2.5 text-sm font-semibold bg-teal-primary text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-teal-primary font-medium">Saved ✓</span>}
        <Link
          href={`/instructor/courses/${courseId}/assignments/${assignment.id}/submissions`}
          className="text-sm text-muted-text hover:text-dark-text"
        >
          View Submissions →
        </Link>
      </div>
    </div>
  )
}

function ChecklistItemRow({
  item,
  onDelete,
  onUpdate,
}: {
  item: ChecklistItem
  onDelete: (id: string) => void
  onUpdate: (item: ChecklistItem, text: string, desc: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  const [desc, setDesc] = useState(item.description ?? '')

  const save = () => {
    if (!text.trim()) return
    onUpdate(item, text.trim(), desc.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-teal-primary bg-teal-light/20 p-3 flex flex-col gap-2">
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text"
        />
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text"
        />
        <div className="flex gap-2">
          <button type="button" onClick={save} className="text-xs px-3 py-1 bg-teal-primary text-white rounded-lg">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1 text-muted-text hover:text-dark-text">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-background group">
      <div className="mt-0.5 shrink-0 w-4 h-4 rounded border border-border" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-text">{item.text}</p>
        {item.description && <p className="text-xs text-muted-text mt-0.5">{item.description}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button type="button" onClick={() => setEditing(true)} className="p-1 text-muted-text hover:text-teal-primary" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button type="button" onClick={() => onDelete(item.id)} className="p-1 text-muted-text hover:text-red-500" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

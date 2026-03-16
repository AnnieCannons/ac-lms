'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from './RichTextEditor'
import Link from 'next/link'
import { RUBRIC_TEMPLATES } from '@/data/rubric-templates'
import DatePicker from './DatePicker'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { trashAssignment } from '@/lib/trash-actions'
import { upsertAssignmentOverride, removeAssignmentOverride } from '@/lib/override-actions'

interface CustomTemplate {
  id: string
  name: string
  items: { text: string; description: string }[]
}

const PRESET_SKILL_TAGS = ['HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'Other']

interface ChecklistItem {
  id: string
  text: string
  description: string | null
  order: number
  required: boolean
}

interface Override {
  id: string
  student_id: string
  student_name: string
  due_date: string | null
  excused: boolean
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
    answer_key_url: string | null
    submission_required: boolean
    skill_tags: string[] | null
    is_bonus: boolean
  }
  initialChecklist: ChecklistItem[]
  enrolledStudents: { id: string; name: string }[]
  initialOverrides: Override[]
  onSaved?: (updated: { title: string; description: string | null; how_to_turn_in: string | null; due_date: string | null; published: boolean; submission_required: boolean; is_bonus: boolean; skill_tags: string[]; answer_key_url: string | null }, updatedChecklist: ChecklistItem[]) => void
}

export default function AssignmentEditor({ courseId, assignment, initialChecklist, enrolledStudents, initialOverrides, onSaved }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [title, setTitle] = useState(assignment.title)
  const [description, setDescription] = useState(assignment.description ?? '')
  const [howToTurnIn, setHowToTurnIn] = useState(assignment.how_to_turn_in ?? '')
  const [dueDate, setDueDate] = useState(() => {
    if (!assignment.due_date) return ''
    // Convert stored UTC to PST (UTC-8) date string
    const d = new Date(new Date(assignment.due_date).getTime() - 8 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [published, setPublished] = useState(assignment.published)
  const [submissionRequired, setSubmissionRequired] = useState(assignment.submission_required)
  const [isBonus, setIsBonus] = useState(assignment.is_bonus)
  const [skillTags, setSkillTags] = useState<string[]>(assignment.skill_tags ?? [])
  const [customSkillTags, setCustomSkillTags] = useState<string[]>(
    (assignment.skill_tags ?? []).filter(t => !PRESET_SKILL_TAGS.includes(t))
  )
  const [showCustomTag, setShowCustomTag] = useState(false)
  const [customTagInput, setCustomTagInput] = useState('')
  const [answerKeyUrl, setAnswerKeyUrl] = useState(assignment.answer_key_url ?? '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist)
  const [newItemText, setNewItemText] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemBonus, setNewItemBonus] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  useUnsavedChanges(isDirty)

  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showManageTemplates, setShowManageTemplates] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  useEffect(() => {
    supabase.from('rubric_templates').select('id, name, items').order('name').then(({ data }) => {
      if (data) setCustomTemplates(data as CustomTemplate[])
    })
  }, [])

  const saveAsTemplate = async () => {
    if (!templateName.trim() || checklist.length === 0) return
    setSavingTemplate(true)
    const items = [...checklist].sort((a, b) => a.order - b.order).map(i => ({ text: i.text, description: i.description ?? '' }))
    const { data, error } = await supabase.from('rubric_templates').insert({ name: templateName.trim(), items }).select('id, name, items').single()
    setSavingTemplate(false)
    if (error) { alert(error.message); return }
    setCustomTemplates(prev => [...prev, data as CustomTemplate].sort((a, b) => a.name.localeCompare(b.name)))
    setTemplateName('')
    setShowSaveTemplate(false)
  }

  const deleteCustomTemplate = async (id: string) => {
    if (!window.confirm('Delete this template?')) return
    const { error } = await supabase.from('rubric_templates').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setCustomTemplates(prev => prev.filter(t => t.id !== id))
  }

  const allTemplates = [
    ...RUBRIC_TEMPLATES,
    ...customTemplates.map(t => ({ id: t.id, name: t.name, items: t.items })),
  ]

  const [overrides, setOverrides] = useState<Override[]>(initialOverrides)
  const [showAddOverride, setShowAddOverride] = useState(false)
  const [newStudentId, setNewStudentId] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [savingOverride, setSavingOverride] = useState(false)

  const toggleSkillTag = (tag: string) => {
    setSkillTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
    setIsDirty(true)
  }

  const addCustomSkillTag = () => {
    const tag = customTagInput.trim()
    if (!tag) return
    if (!customSkillTags.includes(tag)) setCustomSkillTags(prev => [...prev, tag])
    setSkillTags(prev => prev.includes(tag) ? prev : [...prev, tag])
    setCustomTagInput('')
    setShowCustomTag(false)
    setIsDirty(true)
  }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('assignments')
      .update({
        title,
        description: description || null,
        how_to_turn_in: howToTurnIn || null,
        due_date: dueDate ? new Date(`${dueDate}T20:59:00-08:00`).toISOString() : null,
        published,
        submission_required: submissionRequired,
        is_bonus: isBonus,
        skill_tags: skillTags,
        answer_key_url: answerKeyUrl.trim() || null,
      })
      .eq('id', assignment.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    setIsDirty(false)
    if (onSaved) {
      onSaved(
        { title, description: description || null, how_to_turn_in: howToTurnIn || null, due_date: dueDate ? new Date(`${dueDate}T20:59:00-08:00`).toISOString() : null, published, submission_required: submissionRequired, is_bonus: isBonus, skill_tags: skillTags, answer_key_url: answerKeyUrl.trim() || null },
        checklist
      )
    } else {
      router.refresh()
    }
  }

  const addChecklistItem = async () => {
    if (!newItemText.trim()) return
    const nextOrder = checklist.length > 0 ? Math.max(...checklist.map(i => i.order)) + 1 : 0
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ assignment_id: assignment.id, text: newItemText.trim(), description: newItemDesc.trim() || null, order: nextOrder, required: !newItemBonus })
      .select('id, text, description, order, required')
      .single()
    if (error) { alert(error.message); return }
    setChecklist(prev => [...prev, data])
    setNewItemText('')
    setNewItemDesc('')
    setNewItemBonus(false)
  }

  const handleItemTextPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length <= 1) return // single line — let default paste handle it
    e.preventDefault()
    const nextOrder = checklist.length > 0 ? Math.max(...checklist.map(i => i.order)) + 1 : 0
    const { data, error } = await supabase
      .from('checklist_items')
      .insert(lines.map((line, i) => ({
        assignment_id: assignment.id, text: line, description: null, order: nextOrder + i, required: true,
      })))
      .select('id, text, description, order, required')
    if (error) { alert(error.message); return }
    if (data) setChecklist(prev => [...prev, ...data])
  }

  const deleteAssignment = async () => {
    if (!window.confirm('Move this assignment to trash?')) return
    const { error } = await trashAssignment(assignment.id, courseId)
    if (error) { alert(error); return }
    router.push(`/instructor/courses/${courseId}/assignments`)
  }

  const toggleChecklistRequired = async (id: string, current: boolean) => {
    const { error } = await supabase.from('checklist_items').update({ required: !current }).eq('id', id)
    if (error) { alert(error.message); return }
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, required: !current } : i))
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

  const commitOverride = async (studentId: string, dueDate: string | null, excused: boolean) => {
    setSavingOverride(true)
    const { id: newId, error } = await upsertAssignmentOverride(
      assignment.id, studentId, courseId, dueDate, excused
    )
    if (error) { alert(error); setSavingOverride(false); return }
    const student = enrolledStudents.find(s => s.id === studentId)
    setOverrides(prev => [...prev.filter(o => o.student_id !== studentId), {
      id: newId!,
      student_id: studentId,
      student_name: student?.name ?? 'Unknown',
      due_date: dueDate,
      excused,
    }])
    setNewStudentId('')
    setNewDueDate('')
    setShowAddOverride(false)
    setSavingOverride(false)
  }

  const saveOverride = () => {
    if (!newStudentId || !newDueDate) return
    commitOverride(newStudentId, newDueDate, false)
  }

  const saveExcused = () => {
    if (!newStudentId) return
    commitOverride(newStudentId, null, true)
  }

  const deleteOverride = async (overrideId: string) => {
    const { error } = await removeAssignmentOverride(overrideId, courseId)
    if (error) { alert(error); return }
    setOverrides(prev => prev.filter(o => o.id !== overrideId))
  }

  const loadTemplate = async (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId)
    if (!template) return
    if (checklist.length > 0 && !window.confirm('Replace the current checklist with this template?')) return
    if (checklist.length > 0) {
      const { error: delError } = await supabase.from('checklist_items').delete().eq('assignment_id', assignment.id)
      if (delError) { alert(`Failed to clear checklist: ${delError.message}`); return }
    }
    setChecklist([])
    if (template.items.length === 0) return
    const { data, error } = await supabase
      .from('checklist_items')
      .insert(template.items.map((item, i) => ({
        assignment_id: assignment.id, text: item.text, description: item.description || null, order: i, required: true,
      })))
      .select('id, text, description, order, required')
    if (error) { alert(`Failed to load template: ${error.message}`); return }
    if (data) setChecklist(data)
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Title</label>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setIsDirty(true) }}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
        />
      </div>

      {/* Toggle buttons row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setPublished(p => !p); setIsDirty(true) }}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-colors ${
            published
              ? 'bg-teal-light text-teal-primary border-teal-primary/30'
              : 'bg-background text-muted-text border-border hover:border-muted-text'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${published ? 'bg-teal-primary' : 'bg-muted-text'}`} />
          {published ? 'Published' : 'Draft'}
        </button>
        <button
          type="button"
          onClick={() => { setSubmissionRequired(r => !r); setIsDirty(true) }}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-colors ${
            submissionRequired
              ? 'badge-amber'
              : 'bg-background text-muted-text border-border hover:border-muted-text'
          }`}
        >
          {submissionRequired ? 'Submission required' : 'No submission'}
        </button>
        <button
          type="button"
          onClick={() => { setIsBonus(b => !b); setIsDirty(true) }}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-colors ${
            isBonus
              ? 'bg-purple-light text-purple-primary border-purple-primary/40'
              : 'bg-background text-muted-text border-border hover:border-muted-text'
          }`}
        >
          {isBonus ? 'Bonus (Level Up)' : 'Bonus?'}
        </button>
        <button
          type="button"
          onClick={deleteAssignment}
          className="ml-auto flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-red-400/40 text-red-400 hover:border-red-400 hover:text-red-500 transition-colors"
        >
          Move to trash
        </button>
      </div>

      {/* Skill tags */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Skills</label>
        <div className="flex flex-wrap gap-1.5">
          {[...PRESET_SKILL_TAGS, ...customSkillTags].map(tag => (
            <button key={tag} type="button" onClick={() => toggleSkillTag(tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                skillTags.includes(tag)
                  ? 'bg-teal-primary text-white border-teal-primary'
                  : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
              }`}>{tag}</button>
          ))}
          {!showCustomTag ? (
            <button type="button" onClick={() => setShowCustomTag(true)}
              className="text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors">
              + Add
            </button>
          ) : (
            <div className="flex gap-1.5 items-center w-full mt-1">
              <input type="text" value={customTagInput} onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustomSkillTag(); if (e.key === 'Escape') { setShowCustomTag(false); setCustomTagInput('') } }}
                placeholder="Tag name…" autoFocus
                className="flex-1 border border-border rounded-lg px-2 py-1 text-xs bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
              <button type="button" onClick={addCustomSkillTag} disabled={!customTagInput.trim()}
                className="text-xs font-semibold bg-teal-primary text-white px-2 py-1 rounded-lg hover:opacity-90 disabled:opacity-50">Add</button>
              <button type="button" onClick={() => { setShowCustomTag(false); setCustomTagInput('') }}
                className="text-xs text-muted-text hover:text-dark-text">✕</button>
            </div>
          )}
        </div>
        {isBonus && (
          <p className="text-xs text-purple-primary mt-2">This assignment is marked as bonus — it will appear in Level Up Your Skills.</p>
        )}
      </div>

      {/* Due date */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Due Date</label>
        <div className="flex items-center gap-3">
          <DatePicker value={dueDate} onChange={v => { setDueDate(v); setIsDirty(true) }} />
          <span className="text-sm text-muted-text">8:59 PM PST</span>
        </div>
      </div>

      {/* Answer Key URL */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Answer Key URL</label>
        <input
          type="url"
          value={answerKeyUrl}
          onChange={e => { setAnswerKeyUrl(e.target.value); setIsDirty(true) }}
          placeholder="https://…"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">Instructions</label>
        <RichTextEditor content={description} onChange={v => { setDescription(v); setIsDirty(true) }} placeholder="Assignment instructions…" storagePath={`assignments/${assignment.id}/images/`} />
      </div>

      {/* How to turn in */}
      <div>
        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">How to Turn In</label>
        <RichTextEditor content={howToTurnIn} onChange={v => { setHowToTurnIn(v); setIsDirty(true) }} placeholder="How students should submit this assignment…" storagePath={`assignments/${assignment.id}/images/`} />
      </div>

      {/* Checklist */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">Grading Checklist</label>
            {checklist.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Clear all checklist items?')) return
                  await supabase.from('checklist_items').delete().eq('assignment_id', assignment.id)
                  setChecklist([])
                }}
                className="text-xs text-red-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {checklist.length > 0 && !showSaveTemplate && (
              <button
                type="button"
                onClick={() => setShowSaveTemplate(true)}
                className="text-xs text-muted-text hover:text-teal-primary transition-colors"
              >
                Save as template…
              </button>
            )}
            {customTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => setShowManageTemplates(m => !m)}
                className="text-xs text-muted-text hover:text-dark-text transition-colors"
              >
                {showManageTemplates ? 'Done' : 'Manage…'}
              </button>
            )}
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) { loadTemplate(e.target.value); e.currentTarget.value = '' } }}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-primary"
            >
              <option value="">Load template…</option>
              {RUBRIC_TEMPLATES.length > 0 && (
                <optgroup label="Built-in">
                  {RUBRIC_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              )}
              {customTemplates.length > 0 && (
                <optgroup label="Custom">
                  {customTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
        {showSaveTemplate && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-surface rounded-lg border border-border">
            <input
              autoFocus
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAsTemplate(); if (e.key === 'Escape') { setShowSaveTemplate(false); setTemplateName('') } }}
              placeholder="Template name…"
              className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            />
            <button type="button" onClick={saveAsTemplate} disabled={!templateName.trim() || savingTemplate}
              className="text-xs font-semibold px-3 py-1.5 bg-teal-primary text-white rounded-lg disabled:opacity-50">
              {savingTemplate ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setShowSaveTemplate(false); setTemplateName('') }}
              className="text-xs text-muted-text hover:text-dark-text">Cancel</button>
          </div>
        )}
        {showManageTemplates && customTemplates.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3 p-3 bg-surface rounded-lg border border-border">
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Custom Templates</p>
            {customTemplates.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-dark-text">{t.name}</span>
                <button
                  type="button"
                  onClick={() => deleteCustomTemplate(t.id)}
                  className="text-xs text-red-400 hover:text-red-500 transition-colors shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 mb-4">
          {checklist.sort((a, b) => a.order - b.order).map(item => (
            <ChecklistItemRow key={item.id} item={item} onDelete={deleteChecklistItem} onUpdate={updateChecklistItem} onToggleRequired={toggleChecklistRequired} />
          ))}
        </div>
        {/* Add new item */}
        <div className="bg-surface rounded-xl border border-dashed border-border p-4 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Add Item</p>
            <p className="text-xs text-muted-text">Tip: paste multiple lines to add items in bulk</p>
          </div>
          <input
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
            onPaste={handleItemTextPaste}
            placeholder="Item text…"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
          />
          <input
            value={newItemDesc}
            onChange={e => setNewItemDesc(e.target.value)}
            placeholder="Description (optional)…"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addChecklistItem}
              disabled={!newItemText.trim()}
              className="px-4 py-1.5 text-sm bg-teal-primary text-white rounded-lg hover:bg-teal-600 disabled:opacity-40"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={() => setNewItemBonus(b => !b)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${newItemBonus ? 'text-amber-600 border-amber-300 bg-amber-50' : 'border-border text-muted-text hover:text-amber-600 hover:border-amber-300'}`}
            >
              {newItemBonus ? 'Bonus (not required)' : 'Bonus?'}
            </button>
          </div>
        </div>
      </div>

      {/* Student Overrides */}
      {enrolledStudents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide">Student Overrides</label>
            {!showAddOverride && (
              <button
                type="button"
                onClick={() => setShowAddOverride(true)}
                className="text-xs text-teal-primary hover:underline"
              >
                + Add override
              </button>
            )}
          </div>

          {overrides.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {overrides.sort((a, b) => a.student_name.localeCompare(b.student_name)).map(o => (
                <div key={o.id} className="flex items-center gap-3 bg-surface rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-dark-text flex-1">{o.student_name}</span>
                  {o.excused ? (
                    <span className="badge-amber text-xs font-medium border rounded-full px-2 py-0.5">Excused</span>
                  ) : o.due_date ? (
                    <span className="text-xs text-muted-text">Due {new Date(o.due_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  ) : (
                    <span className="text-xs text-muted-text">No due date</span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteOverride(o.id)}
                    className="text-xs text-muted-text hover:text-red-400 transition-colors ml-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddOverride && (
            <div className="bg-surface rounded-lg border border-border p-3 flex flex-col gap-3">
              <select
                value={newStudentId}
                onChange={e => setNewStudentId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
              >
                <option value="">Select student…</option>
                {enrolledStudents
                  .filter(s => !overrides.some(o => o.student_id === s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))
                }
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
                  placeholder="Custom due date (optional)"
                />
                <span className="text-xs text-muted-text shrink-0">or</span>
                <button
                  type="button"
                  onClick={saveExcused}
                  disabled={!newStudentId || savingOverride}
                  className="badge-amber text-xs font-medium px-3 py-2 rounded-lg border transition-colors whitespace-nowrap disabled:opacity-40"
                >
                  + Excuse
                </button>
              </div>
              <div className="flex gap-2">
                {newDueDate && (
                  <button
                    type="button"
                    onClick={saveOverride}
                    disabled={!newStudentId || savingOverride}
                    className="px-4 py-1.5 text-sm font-semibold bg-teal-primary text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                  >
                    {savingOverride ? 'Saving…' : 'Save due date'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowAddOverride(false); setNewStudentId(''); setNewDueDate('') }}
                  className="px-4 py-1.5 text-sm text-muted-text hover:text-dark-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {overrides.length === 0 && !showAddOverride && (
            <p className="text-sm text-muted-text">No overrides. All students see the default due date.</p>
          )}
        </div>
      )}

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
        <span aria-live="polite" className="text-sm text-teal-primary font-medium">{saved ? 'Saved ✓' : ''}</span>
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
  onToggleRequired,
}: {
  item: ChecklistItem
  onDelete: (id: string) => void
  onUpdate: (item: ChecklistItem, text: string, desc: string) => void
  onToggleRequired: (id: string, current: boolean) => void
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
      <div className="mt-0.5 shrink-0 w-4 h-4 rounded border border-gray-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-dark-text">{item.text}</p>
          {!item.required && (
            <span className="badge-amber text-xs font-medium px-1.5 py-0.5 rounded-full border">
              Bonus
            </span>
          )}
        </div>
        {item.description && <p className="text-xs text-muted-text mt-0.5">{item.description}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={() => onToggleRequired(item.id, item.required)}
          className="text-xs px-2 py-0.5 rounded border border-border text-muted-text hover:text-amber-600 hover:border-amber-300 transition-colors"
          title={item.required ? 'Mark as bonus (not required to submit)' : 'Make required'}
        >
          {item.required ? 'Bonus?' : 'Required?'}
        </button>
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

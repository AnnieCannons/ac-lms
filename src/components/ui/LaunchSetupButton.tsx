'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Task = {
  id: string
  label: string
  order: number
  global?: boolean   // value is the same for all courses (stored in template)
  linkText?: string  // text of <a> in Everyday Resources to sync on save
}

type TemplateContent = {
  tasks: Task[]
  globalValues: Record<string, string>
}

type Values = Record<string, string>

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

const DEFAULT_TASKS: Task[] = [
  { id: 'zoom-link',       label: 'Zoom Link',            order: 0, global: false, linkText: 'Zoom Link' },
  { id: 'slack-link',      label: 'Slack Link',           order: 1, global: false, linkText: 'Slack Link' },
  { id: 'zoom-recordings', label: 'Zoom Recordings Link', order: 2, global: false, linkText: 'Zoom Recordings' },
  { id: 'office-hours',    label: 'Office Hours Link',    order: 3, global: false, linkText: 'Book an Office Hours appointment' },
]

/** Update the href of <a> tags whose text content matches linkText */
function updateLinkInHtml(html: string, linkText: string, newUrl: string): string {
  return html.replace(
    /<a\b([^>]*?)href="([^"]*)"([^>]*?)>([\s\S]*?)<\/a>/g,
    (match, before, _href, after, content) => {
      const text = content.replace(/<[^>]+>/g, '').trim()
      if (text.toLowerCase() === linkText.toLowerCase()) {
        return `<a${before}href="${newUrl}"${after}>${content}</a>`
      }
      return match
    },
  )
}

export default function LaunchSetupButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-teal-primary border border-teal-primary px-4 py-1.5 rounded-full hover:bg-teal-light transition-colors"
      >
        🚀 Launch setup
      </button>
      {open && <LaunchSetupModal courseId={courseId} onClose={() => setOpen(false)} />}
    </>
  )
}

function LaunchSetupModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [globalValues, setGlobalValues] = useState<Values>({})  // shared across all courses
  const [values, setValues] = useState<Values>({})               // per-course
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: templateRow } = await supabase
        .from('global_content')
        .select('content')
        .eq('slug', 'launch-tasks')
        .single()

      let loadedTasks: Task[] = DEFAULT_TASKS
      let loadedGlobalValues: Values = {}

      if (templateRow?.content) {
        try {
          const parsed = JSON.parse(templateRow.content)
          if (Array.isArray(parsed)) {
            // Legacy format (just array of tasks, no global values)
            loadedTasks = parsed
          } else {
            loadedTasks = parsed.tasks ?? DEFAULT_TASKS
            loadedGlobalValues = parsed.globalValues ?? {}
          }
        } catch { /* ignore parse errors */ }
      }

      setTasks(loadedTasks)
      setGlobalValues(loadedGlobalValues)

      // Load this course's saved per-course values
      const { data: section } = await supabase
        .from('course_sections')
        .select('id, content')
        .eq('course_id', courseId)
        .eq('type', 'launch_setup')
        .maybeSingle()

      if (section) {
        setSectionId(section.id)
        try { setValues(JSON.parse(section.content ?? '{}').values ?? {}) } catch { /* ignore */ }
      }

      setLoading(false)
    }
    load()
  }, [courseId])

  // Copy only per-course values from the last saved course (global values stay as-is)
  const copyFromLastTime = async () => {
    setCopying(true)
    const { data: sections } = await supabase
      .from('course_sections')
      .select('course_id, content')
      .eq('type', 'launch_setup')
      .neq('course_id', courseId)

    if (sections && sections.length > 0) {
      const last = sections[sections.length - 1]
      try {
        const parsed = JSON.parse(last.content ?? '{}')
        setValues(parsed.values ?? {})
      } catch { /* ignore */ }
    }
    setCopying(false)
  }

  const handleSave = async () => {
    setSaving(true)

    // Save tasks + global values to global_content (template)
    const templateContent: TemplateContent = { tasks, globalValues }
    await supabase.from('global_content').upsert({
      slug: 'launch-tasks',
      title: 'Launch Tasks',
      content: JSON.stringify(templateContent),
    })

    // Upsert per-course values into course_sections
    const content = JSON.stringify({ values })
    if (sectionId) {
      await supabase.from('course_sections').update({ content }).eq('id', sectionId)
    } else {
      const { data } = await supabase
        .from('course_sections')
        .insert({ course_id: courseId, title: 'Launch Setup', type: 'launch_setup', published: false, content, order: 999 })
        .select('id').single()
      if (data) setSectionId(data.id)
    }

    // Sync URLs to Everyday Resources in General Info for this course
    await syncToEverydayResources()

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const syncToEverydayResources = async () => {
    const { data: section } = await supabase
      .from('course_sections')
      .select('id, content, type')
      .eq('course_id', courseId)
      .ilike('title', 'everyday resources')
      .maybeSingle()

    if (!section) return

    let html = section.content ?? ''

    // If section is still linked to global template, read content from global_content
    if (!html && section.type?.startsWith('global:')) {
      const slug = (section.type as string).slice(7)
      const { data: global } = await supabase
        .from('global_content')
        .select('content')
        .eq('slug', slug)
        .single()
      html = global?.content ?? ''
    }

    if (!html) return

    const allValues = { ...globalValues, ...values }
    let changed = false

    for (const task of tasks) {
      if (!task.linkText) continue
      const url = allValues[task.id]
      if (!url) continue
      const updated = updateLinkInHtml(html, task.linkText, url)
      if (updated !== html) { html = updated; changed = true }
    }

    if (changed) {
      const updates: Record<string, string> = { content: html }
      // Fork from global if needed
      if (section.type?.startsWith('global:')) updates.type = 'text'
      await supabase.from('course_sections').update(updates).eq('id', section.id)
    }
  }

  const setValueForTask = (taskId: string, value: string, isGlobal: boolean) => {
    if (isGlobal) {
      setGlobalValues(prev => ({ ...prev, [taskId]: value }))
    } else {
      setValues(prev => ({ ...prev, [taskId]: value }))
    }
  }

  const toggleGlobal = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const newGlobal = !(t.global ?? false)
      if (newGlobal) {
        // Promote to global: move value from per-course to globalValues
        const val = values[taskId] ?? ''
        setGlobalValues(g => ({ ...g, [taskId]: val }))
        setValues(v => { const next = { ...v }; delete next[taskId]; return next })
      } else {
        // Demote to per-course: move value from globalValues to per-course
        const val = globalValues[taskId] ?? ''
        setValues(v => ({ ...v, [taskId]: val }))
        setGlobalValues(g => { const next = { ...g }; delete next[taskId]; return next })
      }
      return { ...t, global: newGlobal }
    }))
  }

  const addTask = () => {
    if (!newLabel.trim()) return
    const task: Task = { id: generateId(), label: newLabel.trim(), order: tasks.length, global: false }
    setTasks(prev => [...prev, task])
    setNewLabel('')
    setAddingTask(false)
  }

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    setValues(prev => { const next = { ...prev }; delete next[id]; return next })
    setGlobalValues(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-bold text-dark-text">Launch Setup</h2>
              <p className="text-xs text-muted-text mt-0.5">Fill in course-specific details for this cohort</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={copyFromLastTime}
                disabled={copying || loading}
                className="text-xs text-muted-text hover:text-teal-primary transition-colors disabled:opacity-50"
              >
                {copying ? 'Copying…' : '↩ Same as last time'}
              </button>
              <button onClick={onClose} aria-label="Close" className="text-muted-text hover:text-dark-text text-xl leading-none">✕</button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <p className="text-sm text-muted-text">Loading…</p>
            ) : (
              <div className="flex flex-col gap-5">
                {tasks.map(task => {
                  const isGlobal = task.global ?? false
                  const currentValue = isGlobal ? (globalValues[task.id] ?? '') : (values[task.id] ?? '')
                  return (
                    <div key={task.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                            {task.label}
                          </label>
                          {isGlobal && (
                            <span className="text-xs text-teal-primary bg-teal-light px-1.5 py-0.5 rounded font-medium">
                              Same for all classes
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleGlobal(task.id)}
                            className="text-xs text-muted-text hover:text-teal-primary transition-colors"
                            title={isGlobal ? 'Make per-class instead' : 'Use the same value for all classes'}
                          >
                            {isGlobal ? '⊖ Make per-class' : '🌐 Same for all'}
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-border hover:text-red-400 transition-colors text-xs"
                            title="Remove this item"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={currentValue}
                        onChange={e => setValueForTask(task.id, e.target.value, isGlobal)}
                        placeholder={`Enter ${task.label}…`}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      />
                      {isGlobal && (
                        <p className="text-xs text-muted-text mt-1">Changing this updates all classes</p>
                      )}
                    </div>
                  )
                })}

                {/* Add new task */}
                {addingTask ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addTask()
                        if (e.key === 'Escape') { setAddingTask(false); setNewLabel('') }
                      }}
                      placeholder="Item label (e.g. Absence Form Link)…"
                      autoFocus
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    />
                    <button
                      onClick={addTask}
                      disabled={!newLabel.trim()}
                      className="bg-teal-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingTask(false); setNewLabel('') }}
                      className="text-xs text-muted-text hover:text-dark-text transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTask(true)}
                    className="text-sm text-teal-primary font-medium hover:underline self-start"
                  >
                    + Add item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-border shrink-0">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-sm text-teal-primary font-medium">✓ Saved</span>}
            <button onClick={onClose} className="text-sm text-muted-text hover:text-dark-text transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Task = {
  id: string
  label: string
  order: number
  linkText?: string  // text of <a> in Everyday Resources to sync on save
}

type Values = Record<string, string>

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

const DEFAULT_TASKS: Task[] = [
  { id: 'zoom-link',       label: 'Zoom Link',            order: 0, linkText: 'Zoom Link' },
  { id: 'slack-link',      label: 'Slack Link',           order: 1, linkText: 'Slack Link' },
  { id: 'zoom-recordings', label: 'Zoom Recordings Link', order: 2, linkText: 'Zoom Recordings' },
  { id: 'office-hours',    label: 'Office Hours Link',    order: 3, linkText: 'Book an Office Hours appointment' },
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
  const [values, setValues] = useState<Values>({})
  const [lastValues, setLastValues] = useState<Values>({})
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [addingTask, setAddingTask] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: templateRow } = await supabase
        .from('global_content')
        .select('content')
        .eq('slug', 'launch-tasks')
        .single()

      let loadedTasks: Task[] = DEFAULT_TASKS
      if (templateRow?.content) {
        try {
          const parsed = JSON.parse(templateRow.content)
          // Handle both legacy array format and newer { tasks } format
          loadedTasks = Array.isArray(parsed) ? parsed : (parsed.tasks ?? DEFAULT_TASKS)
        } catch { /* ignore */ }
      }
      setTasks(loadedTasks)

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

      // Load previous course's values for per-field "Same as last time"
      const { data: otherSections } = await supabase
        .from('course_sections')
        .select('content')
        .eq('type', 'launch_setup')
        .neq('course_id', courseId)
      if (otherSections && otherSections.length > 0) {
        const last = otherSections[otherSections.length - 1]
        try { setLastValues(JSON.parse(last.content ?? '{}').values ?? {}) } catch { /* ignore */ }
      }

      setLoading(false)
    }
    load()
  }, [courseId])

  const handleSave = async () => {
    setSaving(true)

    // Save task list to global_content (template — shared across all courses)
    await supabase.from('global_content').upsert({
      slug: 'launch-tasks',
      title: 'Launch Tasks',
      content: JSON.stringify({ tasks }),
    })

    // Upsert per-course values
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
    if (!html && section.type?.startsWith('global:')) {
      const slug = (section.type as string).slice(7)
      const { data: global } = await supabase
        .from('global_content').select('content').eq('slug', slug).single()
      html = global?.content ?? ''
    }
    if (!html) return

    let changed = false
    for (const task of tasks) {
      if (!task.linkText) continue
      const url = values[task.id]
      if (!url) continue
      const updated = updateLinkInHtml(html, task.linkText, url)
      if (updated !== html) { html = updated; changed = true }
    }

    if (changed) {
      const updates: Record<string, string> = { content: html }
      if (section.type?.startsWith('global:')) updates.type = 'text'
      await supabase.from('course_sections').update(updates).eq('id', section.id)
    }
  }

  const addTask = () => {
    if (!newLabel.trim()) return
    setTasks(prev => [...prev, { id: generateId(), label: newLabel.trim(), order: prev.length }])
    setNewLabel('')
    setAddingTask(false)
  }

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    setValues(prev => { const next = { ...prev }; delete next[id]; return next })
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
            <button onClick={onClose} aria-label="Close" className="text-muted-text hover:text-dark-text text-xl leading-none">✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <p className="text-sm text-muted-text">Loading…</p>
            ) : (
              <div className="flex flex-col gap-5">
                {tasks.map(task => (
                  <div key={task.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                        {task.label}
                      </label>
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {lastValues[task.id] && (
                          <button
                            onClick={() => setValues(prev => ({ ...prev, [task.id]: lastValues[task.id] }))}
                            className="text-xs text-muted-text hover:text-teal-primary transition-colors"
                            title={`Fill with: ${lastValues[task.id]}`}
                          >
                            ↩ Same as last time
                          </button>
                        )}
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
                      value={values[task.id] ?? ''}
                      onChange={e => setValues(prev => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder={`Enter ${task.label}…`}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                    />
                  </div>
                ))}

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

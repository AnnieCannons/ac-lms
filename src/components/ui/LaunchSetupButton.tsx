'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Task = {
  id: string
  label: string
  order: number
  linkText?: string
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

function extractLinkFromHtml(html: string, linkText: string): string {
  let found = ''
  html.replace(
    /<a\b([^>]*?)href="([^"]*)"([^>]*?)>([\s\S]*?)<\/a>/g,
    (_m, _b, href, _a, content) => {
      if (!found && content.replace(/<[^>]+>/g, '').trim().toLowerCase() === linkText.toLowerCase()) found = href
      return _m
    },
  )
  return found
}

function extractAllLinkLabelsFromHtml(html: string): string[] {
  const labels: string[] = []
  html.replace(/<a\b[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g, (_m, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim()
    if (text) labels.push(text)
    return _m
  })
  return labels
}

function updateLinkInHtml(html: string, linkText: string, newUrl: string): string {
  return html.replace(
    /<a\b([^>]*?)href="([^"]*)"([^>]*?)>([\s\S]*?)<\/a>/g,
    (match, before, _href, after, content) => {
      const text = content.replace(/<[^>]+>/g, '').trim()
      if (text.toLowerCase() === linkText.toLowerCase()) return `<a${before}href="${newUrl}"${after}>${content}</a>`
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

  const [tasks, setTasks] = useState<Task[]>([])           // global template tasks
  const [extraTasks, setExtraTasks] = useState<Task[]>([]) // per-course tasks
  const [values, setValues] = useState<Values>({})
  const [lastValues, setLastValues] = useState<Values>({})
  const [erLinks, setErLinks] = useState<string[]>([])     // link labels available from Everyday Resources
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Add item form state
  const [addingTask, setAddingTask] = useState(false)
  const [addSelection, setAddSelection] = useState('') // dropdown value: ER label or '__custom__'
  const [customLabel, setCustomLabel] = useState('')
  const [addScope, setAddScope] = useState<'global' | 'class'>('global')

  useEffect(() => {
    const load = async () => {
      // Load template tasks
      const { data: templateRow } = await supabase.from('global_content').select('content').eq('slug', 'launch-tasks').single()
      let loadedTasks: Task[] = DEFAULT_TASKS
      if (templateRow?.content) {
        try {
          const parsed = JSON.parse(templateRow.content)
          loadedTasks = Array.isArray(parsed) ? parsed : (parsed.tasks ?? DEFAULT_TASKS)
        } catch { /* ignore */ }
      }
      setTasks(loadedTasks)

      // Load per-course section
      const { data: section } = await supabase
        .from('course_sections').select('id, content').eq('course_id', courseId).eq('type', 'launch_setup').maybeSingle()

      let savedValues: Values = {}
      let savedExtraTasks: Task[] = []
      if (section) {
        setSectionId(section.id)
        try {
          const parsed = JSON.parse(section.content ?? '{}')
          savedValues = parsed.values ?? {}
          savedExtraTasks = parsed.extraTasks ?? []
        } catch { /* ignore */ }
      }
      setExtraTasks(savedExtraTasks)

      // Load Everyday Resources HTML for pre-populating values and available links dropdown
      const { data: erSection } = await supabase
        .from('course_sections').select('content, type').eq('course_id', courseId).ilike('title', 'everyday resources').maybeSingle()

      let erHtml = erSection?.content ?? ''
      if (!erHtml && erSection?.type?.startsWith('global:')) {
        const slug = (erSection.type as string).slice(7)
        const { data: g } = await supabase.from('global_content').select('content').eq('slug', slug).single()
        erHtml = g?.content ?? ''
      }

      if (erHtml) {
        // Pre-populate values for tasks with no saved value
        const allTasks = [...loadedTasks, ...savedExtraTasks]
        for (const task of allTasks) {
          if (task.linkText && !savedValues[task.id]) {
            const href = extractLinkFromHtml(erHtml, task.linkText)
            if (href) savedValues = { ...savedValues, [task.id]: href }
          }
        }
        setErLinks(extractAllLinkLabelsFromHtml(erHtml))
      }

      setValues(savedValues)

      // Load previous course's values for per-field "Same as last time"
      const { data: otherSections } = await supabase
        .from('course_sections').select('content').eq('type', 'launch_setup').neq('course_id', courseId)
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

    await supabase.from('global_content').upsert({
      slug: 'launch-tasks', title: 'Launch Tasks', content: JSON.stringify({ tasks }),
    })

    const content = JSON.stringify({ values, extraTasks })
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
      .from('course_sections').select('id, content, type').eq('course_id', courseId).ilike('title', 'everyday resources').maybeSingle()
    if (!section) return

    let html = section.content ?? ''
    if (!html && section.type?.startsWith('global:')) {
      const slug = (section.type as string).slice(7)
      const { data: g } = await supabase.from('global_content').select('content').eq('slug', slug).single()
      html = g?.content ?? ''
    }
    if (!html) return

    let changed = false
    for (const task of [...tasks, ...extraTasks]) {
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

  const confirmAddTask = () => {
    const label = addSelection === '__custom__' ? customLabel.trim() : addSelection
    if (!label) return

    const newTask: Task = {
      id: generateId(),
      label,
      order: tasks.length + extraTasks.length,
      linkText: label, // matches the ER link text (or close enough for custom)
    }

    if (addScope === 'global') {
      setTasks(prev => [...prev, newTask])
    } else {
      setExtraTasks(prev => [...prev, newTask])
    }

    resetAddForm()
  }

  const resetAddForm = () => {
    setAddingTask(false)
    setAddSelection('')
    setCustomLabel('')
    setAddScope('global')
  }

  const deleteTask = (id: string, isExtra: boolean) => {
    if (isExtra) setExtraTasks(prev => prev.filter(t => t.id !== id))
    else setTasks(prev => prev.filter(t => t.id !== id))
    setValues(prev => { const next = { ...prev }; delete next[id]; return next })
  }

  // Links from ER not already in any task list
  const allTaskLabels = new Set([...tasks, ...extraTasks].map(t => t.linkText ?? t.label))
  const availableErLinks = erLinks.filter(l => !allTaskLabels.has(l))

  const renderTask = (task: Task, isExtra: boolean) => (
    <div key={task.id} className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-text uppercase tracking-wide">{task.label}</label>
          {isExtra && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-border/40 text-muted-text">This class</span>
          )}
        </div>
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
          <button onClick={() => deleteTask(task.id, isExtra)} className="text-border hover:text-red-400 transition-colors text-xs">✕</button>
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
  )

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
            <div>
              <h2 className="text-base font-bold text-dark-text">Launch Setup</h2>
              <p className="text-xs text-muted-text mt-0.5">Fill in course-specific details for this cohort</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-muted-text hover:text-dark-text text-xl leading-none">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <p className="text-sm text-muted-text">Loading…</p>
            ) : (
              <div className="flex flex-col gap-5">
                {tasks.map(t => renderTask(t, false))}
                {extraTasks.map(t => renderTask(t, true))}

                {/* Add item form */}
                {addingTask ? (
                  <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-background">
                    {/* Dropdown: pick from ER links or custom */}
                    <div>
                      <label className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1 block">
                        Choose a link
                      </label>
                      <select
                        value={addSelection}
                        onChange={e => setAddSelection(e.target.value)}
                        autoFocus
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      >
                        <option value="">Select…</option>
                        {availableErLinks.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                        <option value="__custom__">Custom (type your own)…</option>
                      </select>
                    </div>

                    {addSelection === '__custom__' && (
                      <input
                        type="text"
                        value={customLabel}
                        onChange={e => setCustomLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmAddTask(); if (e.key === 'Escape') resetAddForm() }}
                        placeholder="Label (e.g. Absence Form Link)…"
                        autoFocus
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      />
                    )}

                    {/* Scope toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-text">Add to:</span>
                      <button
                        type="button"
                        onClick={() => setAddScope('global')}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${addScope === 'global' ? 'bg-teal-light text-teal-primary border-teal-primary/30' : 'border-border text-muted-text hover:border-teal-primary/30'}`}
                      >
                        All classes
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddScope('class')}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${addScope === 'class' ? 'bg-teal-light text-teal-primary border-teal-primary/30' : 'border-border text-muted-text hover:border-teal-primary/30'}`}
                      >
                        Just this class
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={confirmAddTask}
                        disabled={!addSelection || (addSelection === '__custom__' && !customLabel.trim())}
                        className="bg-teal-primary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        Add
                      </button>
                      <button onClick={resetAddForm} className="text-xs text-muted-text hover:text-dark-text transition-colors">
                        Cancel
                      </button>
                    </div>
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

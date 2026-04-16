'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'

type ResourceType = 'video' | 'reading' | 'link' | 'file'
type Day = { id: string; day_name: string; order: number }
type Module = { id: string; title: string; order: number; week_number: number | null; category: string | null; module_days: Day[] }

interface Props {
  courseId: string
  className?: string
  variant?: 'default' | 'link'
  defaultModuleId?: string
  defaultSection?: 'coding' | 'career'
  instructorOnly?: boolean
}

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'video', label: 'Video' },
  { value: 'reading', label: 'Reading' },
  { value: 'file', label: 'File' },
]

export default function AddResourceButton({ courseId, className, variant = 'default', defaultModuleId, defaultSection: defaultSectionProp, instructorOnly = false }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [section, setSection] = useState<'coding' | 'career'>('coding')
  const [moduleId, setModuleId] = useState('')
  const [dayId, setDayId] = useState('')
  const [type, setType] = useState<ResourceType>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewModule, setShowNewModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [moduleError, setModuleError] = useState<string | null>(null)

  const hasCareer = modules.some(m => m.category === 'career')
  const hasCoding = modules.some(m => m.category !== 'career')
  const showSectionFilter = hasCareer && hasCoding

  const sectionModules = section === 'career'
    ? modules.filter(m => m.category === 'career')
    : modules.filter(m => m.category !== 'career')

  const days = sectionModules.find(m => m.id === moduleId)?.module_days
    .slice()
    .sort((a, b) => a.order - b.order) ?? []

  const handleOpen = async () => {
    const { data } = await supabase
      .from('modules')
      .select('id, title, order, week_number, category, module_days(id, day_name, order)')
      .eq('course_id', courseId)
      .order('order', { ascending: true })
    const mods = (data ?? []).filter((m: Module) => m.title && !m.title.includes('DO NOT PUBLISH'))
    const resolvedSection = defaultSectionProp ?? (mods.some(m => m.category !== 'career') ? 'coding' : 'career')
    const firstMods = resolvedSection === 'career' ? mods.filter(m => m.category === 'career') : mods.filter(m => m.category !== 'career')
    setModules(mods)
    setSection(resolvedSection)
    setModuleId(defaultModuleId && mods.some(m => m.id === defaultModuleId) ? defaultModuleId : (firstMods[0]?.id ?? ''))
    setDayId('')
    setType('link')
    setTitle('')
    setUrl('')
    setError(null)
    setShowNewModule(false)
    setNewModuleTitle('')
    setModuleError(null)
    setOpen(true)
  }

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) return
    setModuleError(null)
    const category = section === 'career' ? 'career' : null
    const { data, error } = await supabase
      .from('modules')
      .insert({ course_id: courseId, title: newModuleTitle.trim(), category, order: modules.length })
      .select('id, title, order, week_number, category')
      .single()
    if (error || !data) { setModuleError(error?.message ?? 'Failed to create module'); return }
    const newMod = { ...data, module_days: [] }
    setModules(prev => [...prev, newMod])
    setModuleId(data.id)
    setShowNewModule(false)
    setNewModuleTitle('')
  }

  const handleCreate = async () => {
    if (!title.trim()) { setError('Please enter a title.'); return }
    setError(null)
    setCreating(true)

    // Resolve day: use selected or auto-create a General day
    let targetDayId = dayId
    if (!targetDayId) {
      const allDays = sectionModules.find(m => m.id === moduleId)?.module_days ?? []
      const { data: newDay, error: dayErr } = await supabase
        .from('module_days')
        .insert({ module_id: moduleId, day_name: 'General', order: allDays.length })
        .select('id')
        .single()
      if (dayErr || !newDay) { setError(dayErr?.message ?? 'Failed to create day'); setCreating(false); return }
      targetDayId = newDay.id
    }

    const { data: existing } = await supabase
      .from('resources')
      .select('id')
      .eq('module_day_id', targetDayId)
    const order = (existing ?? []).length
    const { error: err } = await supabase
      .from('resources')
      .insert({ module_day_id: targetDayId, type, title: title.trim(), content: url.trim() || null, order, instructor_only: instructorOnly })
    setCreating(false)
    if (err) { setError(err.message); return }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={variant === 'link'
          ? `text-xs text-muted-text hover:text-teal-primary transition-colors text-left ${className ?? ''}`
          : `text-xs font-semibold bg-teal-light text-teal-primary border border-teal-primary rounded-full px-3 py-1.5 hover:opacity-80 transition-opacity ${className ?? ''}`
        }
      >
        + Add resource
      </button>

      {open && (
        <Modal title="New Resource" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3">
            {showSectionFilter && (
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Section</label>
                <select
                  value={section}
                  onChange={e => {
                    const s = e.target.value as typeof section
                    const nextMods = s === 'career' ? modules.filter(m => m.category === 'career') : modules.filter(m => m.category !== 'career')
                    setSection(s)
                    setModuleId(nextMods[0]?.id ?? '')
                    setDayId('')
                    setShowNewModule(false)
                    setNewModuleTitle('')
                  }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="coding">Course Outline</option>
                  <option value="career">Career Development</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Module</label>
              <select
                value={moduleId}
                onChange={e => { setModuleId(e.target.value); setDayId('') }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              >
                {sectionModules.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>

            {!showNewModule ? (
              <button type="button" onClick={() => setShowNewModule(true)}
                className="text-xs text-teal-primary hover:underline self-start -mt-1">
                + New module
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newModuleTitle}
                    onChange={e => setNewModuleTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateModule(); if (e.key === 'Escape') { setShowNewModule(false); setNewModuleTitle('') } }}
                    placeholder="New module title"
                    autoFocus
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                  <button type="button" onClick={handleCreateModule} disabled={!newModuleTitle.trim()}
                    className="text-sm font-semibold bg-teal-primary text-white px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                    Create
                  </button>
                  <button type="button" onClick={() => { setShowNewModule(false); setNewModuleTitle('') }}
                    className="text-sm text-muted-text hover:text-dark-text px-2">✕</button>
                </div>
                {moduleError && <p className="text-xs text-red-400">{moduleError}</p>}
              </div>
            )}

            {days.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Day <span className="normal-case font-normal text-muted-text">(optional)</span></label>
                <select
                  value={dayId}
                  onChange={e => setDayId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="">— Add to General —</option>
                  {days.map(d => (
                    <option key={d.id} value={d.id}>{d.day_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as ResourceType)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              >
                {RESOURCE_TYPES.map(rt => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Resource title"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setOpen(false)} className="text-sm text-muted-text hover:text-dark-text">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!moduleId || !title.trim() || creating}
              className="text-sm font-semibold bg-teal-primary text-white px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? 'Creating…' : 'Create →'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

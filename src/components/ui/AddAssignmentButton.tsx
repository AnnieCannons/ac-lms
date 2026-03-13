'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'

const SKIP_DAYS = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])

type Day = { id: string; day_name: string; order: number }
type Module = { id: string; title: string; order: number; week_number: number | null; category: string | null; module_days: Day[] }

interface Props {
  courseId: string
  className?: string
  variant?: 'default' | 'link'
  defaultModuleId?: string
  defaultSection?: 'coding' | 'career'
}

export default function AddAssignmentButton({ courseId, className, variant = 'default', defaultModuleId, defaultSection: defaultSectionProp }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [section, setSection] = useState<'coding' | 'career'>('coding')
  const [moduleId, setModuleId] = useState('')
  const [dayId, setDayId] = useState('')
  const [creating, setCreating] = useState(false)
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
    .filter(d => !SKIP_DAYS.has(d.day_name))
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
    if (!moduleId || !dayId) return
    setCreating(true)

    const { data, error } = await supabase
      .from('assignments')
      .insert({ module_day_id: dayId, title: 'New Assignment', published: false, order: 0 })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) { alert(error?.message ?? 'Failed to create'); return }
    setOpen(false)
    router.push(`/instructor/courses/${courseId}/assignments/${data.id}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={variant === 'link'
          ? `text-xs text-muted-text hover:text-teal-primary transition-colors text-left ${className ?? ''}`
          : `text-xs font-semibold bg-purple-light text-purple-primary border border-purple-primary rounded-full px-3 py-1.5 hover:opacity-80 transition-opacity ${className ?? ''}`
        }
      >
        + Add assignment
      </button>

      {open && (
        <Modal title="New Assignment" onClose={() => setOpen(false)}>
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
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-primary"
                >
                  <option value="coding">Coding Class</option>
                  <option value="career">Career Development</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Module</label>
              <select
                value={moduleId}
                onChange={e => { setModuleId(e.target.value); setDayId('') }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-primary"
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

            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                Day <span className="normal-case font-normal text-red-400">(required)</span>
              </label>
              {days.length > 0 ? (
                <select
                  value={dayId}
                  onChange={e => setDayId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-primary"
                >
                  <option value="">— Select a day —</option>
                  {days.map(d => (
                    <option key={d.id} value={d.id}>{d.day_name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-text">This module has no days. Add days to the module first.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setOpen(false)} className="text-sm text-muted-text hover:text-dark-text">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!moduleId || !dayId || creating}
              className="text-sm font-semibold bg-purple-primary text-white px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? 'Creating…' : 'Create & Edit →'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

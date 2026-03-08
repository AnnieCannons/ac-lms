'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Modal from './Modal'
import { createQuizWithQuestions } from '@/lib/quiz-actions'
import { parseQuizText } from '@/lib/quiz-parser'

type CreateType = 'assignment' | 'resource' | 'quiz'
type SectionType = 'coding' | 'career' | 'level_up'
type ResourceType = 'video' | 'reading' | 'link' | 'file'
type Day = { id: string; day_name: string; order: number }
type Module = { id: string; title: string; order: number; week_number: number | null; category: string | null; module_days: Day[]; skill_tags?: string[] | null }

const PRESET_SKILL_TAGS = ['HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'Other']

const SKIP_DAYS = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'video', label: 'Video' },
  { value: 'reading', label: 'Reading' },
  { value: 'file', label: 'File' },
]

interface Props {
  courseId: string
}

export default function CreateButton({ courseId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modules, setModules] = useState<Module[]>([])

  // Type
  const [createType, setCreateType] = useState<CreateType>('assignment')

  // Common
  const [section, setSection] = useState<SectionType>('coding')
  const [moduleId, setModuleId] = useState('')
  const [dayId, setDayId] = useState('')

  // Level Up skill tags
  const [levelUpTags, setLevelUpTags] = useState<string[]>([])
  const [customTags, setCustomTags] = useState<string[]>([])
  const [showCustomTag, setShowCustomTag] = useState(false)
  const [customTagInput, setCustomTagInput] = useState('')

  // New module
  const [showNewModule, setShowNewModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [moduleError, setModuleError] = useState<string | null>(null)

  // Resource fields
  const [resType, setResType] = useState<ResourceType>('link')
  const [resTitle, setResTitle] = useState('')
  const [resUrl, setResUrl] = useState('')

  // Quiz fields
  const [quizTitle, setQuizTitle] = useState('')
  const [quizText, setQuizText] = useState('')

  // Cross-post (career dev only)
  const [crossPost, setCrossPost] = useState(false)
  const [crossModuleId, setCrossModuleId] = useState('')
  const [crossDayId, setCrossDayId] = useState('')

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showSectionFilter = true

  const codingModules = modules.filter(m => m.category !== 'career' && m.category !== 'level_up')
  const crossModuleAllDays = codingModules.find(m => m.id === crossModuleId)?.module_days ?? []
  const crossModuleDays = (createType === 'assignment'
    ? crossModuleAllDays.filter(d => !SKIP_DAYS.has(d.day_name))
    : crossModuleAllDays
  ).slice().sort((a, b) => a.order - b.order)

  const sectionModules = section === 'career'
    ? modules.filter(m => m.category === 'career')
    : section === 'level_up'
      ? modules.filter(m => m.category === 'level_up')
      : modules.filter(m => m.category !== 'career' && m.category !== 'level_up')

  const toggleLevelUpTag = (tag: string) =>
    setLevelUpTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const addCustomTag = () => {
    const tag = customTagInput.trim()
    if (!tag) return
    if (!customTags.includes(tag)) setCustomTags(prev => [...prev, tag])
    setLevelUpTags(prev => prev.includes(tag) ? prev : [...prev, tag])
    setCustomTagInput('')
    setShowCustomTag(false)
  }

  const loadModuleTags = (mod: Module | undefined) => {
    const tags = mod?.skill_tags ?? []
    setLevelUpTags(tags)
    setCustomTags(tags.filter(t => !PRESET_SKILL_TAGS.includes(t)))
  }

  const allDaysForModule = sectionModules.find(m => m.id === moduleId)?.module_days ?? []

  const days = (createType === 'assignment'
    ? allDaysForModule.filter(d => !SKIP_DAYS.has(d.day_name))
    : allDaysForModule
  ).slice().sort((a, b) => a.order - b.order)

  const handleOpen = async () => {
    const { data } = await supabase
      .from('modules')
      .select('id, title, order, week_number, category, skill_tags, module_days(id, day_name, order)')
      .eq('course_id', courseId)
      .order('order', { ascending: true })
    const mods = (data ?? []).filter((m: Module) => m.title && !m.title.includes('DO NOT PUBLISH'))
    const resolvedSection: SectionType = mods.some(m => m.category !== 'career' && m.category !== 'level_up') ? 'coding'
      : mods.some(m => m.category === 'career') ? 'career'
      : 'level_up'
    const firstMods = resolvedSection === 'career' ? mods.filter(m => m.category === 'career')
      : resolvedSection === 'level_up' ? mods.filter(m => m.category === 'level_up')
      : mods.filter(m => m.category !== 'career' && m.category !== 'level_up')
    setModules(mods)
    setSection(resolvedSection)
    setModuleId(firstMods[0]?.id ?? '')
    setDayId('')
    setCreateType('assignment')
    setResType('link')
    setResTitle('')
    setResUrl('')
    setQuizTitle('')
    setQuizText('')
    setCrossPost(false)
    setCrossModuleId('')
    setCrossDayId('')
    setError(null)
    setShowNewModule(false)
    setNewModuleTitle('')
    setModuleError(null)
    setLevelUpTags([])
    setCustomTags([])
    setShowCustomTag(false)
    setCustomTagInput('')
    if (resolvedSection === 'level_up') loadModuleTags(firstMods[0])
    setOpen(true)
  }

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim()) return
    setModuleError(null)
    const category = section === 'career' ? 'career' : section === 'level_up' ? 'level_up' : null
    const { data, error } = await supabase
      .from('modules')
      .insert({ course_id: courseId, title: newModuleTitle.trim(), category, order: modules.length, skill_tags: section === 'level_up' ? levelUpTags : [] })
      .select('id, title, order, week_number, category, skill_tags')
      .single()
    if (error || !data) { setModuleError(error?.message ?? 'Failed to create module'); return }
    setModules(prev => [...prev, { ...data, module_days: [] }])
    setModuleId(data.id)
    setShowNewModule(false)
    setNewModuleTitle('')
  }

  const resolveDay = async (resolvedModuleId: string): Promise<string | null> => {
    if (dayId) return dayId
    const { data: newDay, error: dayErr } = await supabase
      .from('module_days')
      .insert({ module_id: resolvedModuleId, day_name: 'General', order: allDaysForModule.length })
      .select('id')
      .single()
    if (dayErr || !newDay) { setError(dayErr?.message ?? 'Failed to create day'); return null }
    return newDay.id
  }

  const handleCreate = async () => {
    setError(null)
    setCreating(true)
    // If no module yet but a new module name was entered, create it first
    let resolvedModuleId = moduleId
    if (!moduleId && showNewModule && newModuleTitle.trim()) {
      const category = section === 'career' ? 'career' : section === 'level_up' ? 'level_up' : null
      const { data, error } = await supabase
        .from('modules')
        .insert({ course_id: courseId, title: newModuleTitle.trim(), category, order: modules.length, skill_tags: section === 'level_up' ? levelUpTags : [] })
        .select('id, title, order, week_number, category, skill_tags')
        .single()
      if (error || !data) { setError(error?.message ?? 'Failed to create module'); setCreating(false); return }
      const newMod = { ...data, module_days: [] }
      setModules(prev => [...prev, newMod])
      setModuleId(data.id)
      setShowNewModule(false)
      setNewModuleTitle('')
      resolvedModuleId = data.id
    }
    if (!resolvedModuleId) { setCreating(false); return }

    // Update skill_tags on existing level_up modules (auto-created ones already have tags set)
    if (section === 'level_up' && resolvedModuleId === moduleId && moduleId) {
      await supabase.from('modules').update({ skill_tags: levelUpTags }).eq('id', resolvedModuleId)
    }

    const linkedDayId = section === 'career' && crossPost && crossDayId ? crossDayId : null

    if (createType === 'assignment') {
      const targetDayId = await resolveDay(resolvedModuleId)
      if (!targetDayId) { setCreating(false); return }
      const { data, error } = await supabase
        .from('assignments')
        .insert({ module_day_id: targetDayId, title: 'New Assignment', published: false, order: 0, linked_day_id: linkedDayId })
        .select('id')
        .single()
      setCreating(false)
      if (error || !data) { setError(error?.message ?? 'Failed to create'); return }
      setOpen(false)
      router.push(`/instructor/courses/${courseId}/assignments/${data.id}`)

    } else if (createType === 'resource') {
      if (!resTitle.trim()) { setError('Please enter a title.'); setCreating(false); return }
      const targetDayId = await resolveDay(resolvedModuleId)
      if (!targetDayId) { setCreating(false); return }
      const { data: existing } = await supabase.from('resources').select('id').eq('module_day_id', targetDayId)
      const { error: err } = await supabase
        .from('resources')
        .insert({ module_day_id: targetDayId, type: resType, title: resTitle.trim(), content: resUrl.trim() || null, order: (existing ?? []).length, linked_day_id: linkedDayId })
      setCreating(false)
      if (err) { setError(err.message); return }
      setOpen(false)
      router.refresh()

    } else if (createType === 'quiz') {
      const title = quizTitle.trim() || 'New Quiz'
      const questions = quizText.trim() ? parseQuizText(quizText) : []
      const moduleTitle = modules.find(m => m.id === resolvedModuleId)?.title ?? ''
      const dayTitle = days.find(d => d.id === dayId)?.day_name ?? null
      try {
        await createQuizWithQuestions(courseId, title, questions, moduleTitle, dayTitle, linkedDayId)
        setCreating(false)
        setOpen(false)
        router.push(`/instructor/courses/${courseId}/quizzes`)
      } catch (e) {
        setCreating(false)
        setError(e instanceof Error ? e.message : 'Failed to create quiz')
      }
    }
  }

  const isValid = (!!moduleId || (showNewModule && !!newModuleTitle.trim())) && (createType !== 'resource' || !!resTitle.trim())

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-semibold bg-teal-light text-teal-primary border border-teal-primary rounded-full px-3 py-1.5 hover:opacity-80 transition-opacity w-full"
      >
        + Create
      </button>

      {open && (
        <Modal title="Create" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4">
            {/* Type selector */}
            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">What would you like to create?</label>
              <div className="flex gap-2">
                {(['assignment', 'resource', 'quiz'] as CreateType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setCreateType(t); setDayId(''); setError(null) }}
                    className={`flex-1 text-xs font-semibold py-2 rounded-full border transition-colors ${
                      createType === t
                        ? 'bg-teal-primary text-white border-teal-primary'
                        : 'border-border text-muted-text hover:text-dark-text hover:border-dark-text/40'
                    }`}
                  >
                    {t === 'assignment' ? 'Assignment' : t === 'resource' ? 'Resource' : 'Quiz'}
                  </button>
                ))}
              </div>
            </div>

            {/* Section filter */}
            {showSectionFilter && (
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Section</label>
                <select
                  value={section}
                  onChange={e => {
                    const s = e.target.value as SectionType
                    const nextMods = s === 'career' ? modules.filter(m => m.category === 'career')
                      : s === 'level_up' ? modules.filter(m => m.category === 'level_up')
                      : modules.filter(m => m.category !== 'career' && m.category !== 'level_up')
                    setSection(s)
                    setModuleId(nextMods[0]?.id ?? '')
                    setDayId('')
                    setShowNewModule(false)
                    setNewModuleTitle('')
                    if (s === 'level_up') loadModuleTags(nextMods[0])
                    else { setLevelUpTags([]); setCustomTags([]) }
                  }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="coding">Coding Class</option>
                  <option value="career">Career Development</option>
                  <option value="level_up">Level Up Your Skills</option>
                </select>
              </div>
            )}

            {/* Module */}
            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Module</label>
              {sectionModules.length > 0 ? (
                <select
                  value={moduleId}
                  onChange={e => {
                    setModuleId(e.target.value)
                    setDayId('')
                    if (section === 'level_up') loadModuleTags(sectionModules.find(m => m.id === e.target.value))
                  }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  {sectionModules.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-text px-1">No modules yet — create one below.</p>
              )}
            </div>

            {/* New module */}
            {!showNewModule ? (
              <button type="button" onClick={() => setShowNewModule(true)}
                className="text-xs text-teal-primary hover:underline self-start -mt-2">
                + New module
              </button>
            ) : (
              <div className="flex flex-col gap-1.5 -mt-2">
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

            {/* Day */}
            {days.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                  Day <span className="normal-case font-normal text-muted-text">(optional)</span>
                </label>
                <select
                  value={dayId}
                  onChange={e => setDayId(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                >
                  <option value="">— No specific day —</option>
                  {days.map(d => (
                    <option key={d.id} value={d.id}>{d.day_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Skill tags (level up only) */}
            {section === 'level_up' && (
              <div>
                <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-2">
                  Skills <span className="normal-case font-normal text-muted-text">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[...PRESET_SKILL_TAGS, ...customTags].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleLevelUpTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        levelUpTags.includes(tag)
                          ? 'bg-teal-primary text-white border-teal-primary'
                          : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {!showCustomTag ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomTag(true)}
                      className="text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors"
                    >
                      + Add
                    </button>
                  ) : (
                    <div className="flex gap-1.5 items-center w-full mt-1">
                      <input
                        type="text"
                        value={customTagInput}
                        onChange={e => setCustomTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addCustomTag(); if (e.key === 'Escape') { setShowCustomTag(false); setCustomTagInput('') } }}
                        placeholder="Tag name…"
                        autoFocus
                        className="flex-1 border border-border rounded-lg px-2 py-1 text-xs bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      />
                      <button type="button" onClick={addCustomTag} disabled={!customTagInput.trim()}
                        className="text-xs font-semibold bg-teal-primary text-white px-2 py-1 rounded-lg hover:opacity-90 disabled:opacity-50">
                        Add
                      </button>
                      <button type="button" onClick={() => { setShowCustomTag(false); setCustomTagInput('') }}
                        className="text-xs text-muted-text hover:text-dark-text">✕</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cross-post toggle (career dev only) */}
            {section === 'career' && codingModules.length > 0 && (
              <div>
                <label className="flex items-center gap-2 text-sm text-dark-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={crossPost}
                    onChange={e => { setCrossPost(e.target.checked); setCrossModuleId(''); setCrossDayId('') }}
                    className="rounded border-border"
                  />
                  Also show in Course Outline?
                </label>
                {crossPost && (
                  <div className="mt-3 flex flex-col gap-3 pl-5 border-l-2 border-purple-primary/30">
                    <div>
                      <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Coding Module</label>
                      <select
                        value={crossModuleId}
                        onChange={e => { setCrossModuleId(e.target.value); setCrossDayId('') }}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                      >
                        <option value="">— Select module —</option>
                        {codingModules.map(m => (
                          <option key={m.id} value={m.id}>{m.title}</option>
                        ))}
                      </select>
                    </div>
                    {crossModuleId && crossModuleDays.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Day</label>
                        <select
                          value={crossDayId}
                          onChange={e => setCrossDayId(e.target.value)}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                        >
                          <option value="">— No specific day —</option>
                          {crossModuleDays.map(d => (
                            <option key={d.id} value={d.id}>{d.day_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Resource-specific fields */}
            {createType === 'resource' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Type</label>
                  <select
                    value={resType}
                    onChange={e => setResType(e.target.value as ResourceType)}
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
                    value={resTitle}
                    onChange={e => setResTitle(e.target.value)}
                    placeholder="Resource title"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">URL</label>
                  <input
                    type="url"
                    value={resUrl}
                    onChange={e => setResUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                </div>
              </>
            )}

            {/* Quiz-specific fields */}
            {createType === 'quiz' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Quiz Title</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    placeholder="New Quiz"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                    Questions <span className="normal-case font-normal text-muted-text">(optional — paste to bulk import)</span>
                  </label>
                  <textarea
                    value={quizText}
                    onChange={e => setQuizText(e.target.value)}
                    placeholder="Paste questions here..."
                    rows={5}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary font-mono resize-y"
                  />
                  {quizText.trim() && (
                    <p className="text-xs text-muted-text mt-1">{parseQuizText(quizText).length} question(s) detected</p>
                  )}
                </div>
              </>
            )}
          </div>

          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setOpen(false)} className="text-sm text-muted-text hover:text-dark-text">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!isValid || creating}
              className="text-sm font-semibold bg-teal-primary text-white px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {creating ? 'Creating…' : createType === 'assignment' ? 'Create & Edit →' : 'Create →'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

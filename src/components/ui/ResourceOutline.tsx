'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const RESOURCE_ICONS: Record<string, string> = {
  video: '▶',
  reading: '📖',
  link: '🔗',
  file: '📄',
}

interface Resource {
  id: string
  type: string
  title: string
  content: string | null
  description: string | null
  order: number
}

interface Assignment {
  id: string
  title: string
  due_date: string | null
  published: boolean
}

interface Day {
  id: string
  day_name: string
  order: number
  resources?: Resource[]
  assignments?: Assignment[]
}

interface Module {
  id: string
  title: string
  week_number: number | null
  order: number
  module_days: Day[]
}

type SubmissionStatus = 'draft' | 'submitted' | 'graded'
type Grade = 'complete' | 'incomplete' | null

interface SubmissionInfo {
  status: SubmissionStatus
  grade: Grade
}

interface Props {
  modules: Module[]
  courseId: string
  mode: 'resources' | 'assignments'
  editable?: boolean
  instructorView?: boolean
  submissionMap?: Record<string, SubmissionInfo>
}

const SKIP_DAYS = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])

function AssignmentStatusBadge({ info }: { info: SubmissionInfo | undefined }) {
  if (!info) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not Started</span>
  if (info.grade === 'complete') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary shrink-0">Complete ✓</span>
  if (info.grade === 'incomplete') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500 shrink-0">Needs Revision</span>
  if (info.status === 'submitted') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary shrink-0">Turned In</span>
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not Started</span>
}

function EditResourceModal({
  resource,
  onClose,
  onSave,
}: {
  resource: Resource
  onClose: () => void
  onSave: (updated: Resource) => void
}) {
  const supabase = createClient()
  const [title, setTitle] = useState(resource.title)
  const [type, setType] = useState(resource.type)
  const [content, setContent] = useState(resource.content ?? '')
  const [description, setDescription] = useState(resource.description ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('resources')
      .update({ title, type, content: content || null, description: description || null })
      .eq('id', resource.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    onSave({ ...resource, title, type, content: content || null, description: description || null })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-16 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl mb-12"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-bold text-dark-text">Edit Resource</h2>
          <button onClick={onClose} type="button" className="text-muted-text hover:text-dark-text text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
            >
              <option value="video">Video</option>
              <option value="reading">Reading</option>
              <option value="link">Link</option>
              <option value="file">File</option>
            </select>
          </div>
          {type !== 'reading' && (
            <div>
              <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">URL</label>
              <input
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono bg-background text-dark-text"
                placeholder="https://…"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Description <span className="text-muted-text font-normal">(optional)</span></label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text"
              placeholder="Short description shown below the title"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} type="button" className="px-4 py-2 text-sm text-muted-text hover:text-dark-text">Cancel</button>
            <button
              onClick={save}
              type="button"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm bg-teal-primary text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadingResource({
  resource,
  editable,
  onEdit,
  onDelete,
}: {
  resource: Resource
  editable?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border overflow-hidden group">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-border/10 transition-colors text-left min-w-0"
        >
          <span className="text-base shrink-0">{RESOURCE_ICONS.reading}</span>
          <p className="flex-1 text-sm font-medium text-dark-text">{resource.title}</p>
          <span className={`text-xs text-muted-text shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {editable && (
          <div className="flex items-center gap-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button type="button" onClick={onEdit} className="p-1.5 text-muted-text hover:text-teal-primary transition-colors" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button type="button" onClick={onDelete} className="p-1.5 text-muted-text hover:text-red-500 transition-colors" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      {open && resource.content && (
        <div
          className="px-5 py-4 border-t border-border text-sm text-dark-text wiki-content"
          dangerouslySetInnerHTML={{ __html: resource.content }}
        />
      )}
    </div>
  )
}

function LinkResource({
  resource,
  editable,
  onEdit,
  onDelete,
}: {
  resource: Resource
  editable?: boolean
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors group">
      <a
        href={resource.content ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0"
      >
        <span className="text-base shrink-0">{RESOURCE_ICONS[resource.type] ?? '•'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-text group-hover:text-teal-primary transition-colors">{resource.title}</p>
          {resource.description && <p className="text-xs text-muted-text mt-0.5">{resource.description}</p>}
        </div>
        <span className="text-xs text-muted-text shrink-0 group-hover:text-teal-primary">↗</span>
      </a>
      {editable && (
        <div className="flex items-center gap-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button type="button" onClick={onEdit} className="p-1.5 text-muted-text hover:text-teal-primary transition-colors" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" onClick={onDelete} className="p-1.5 text-muted-text hover:text-red-500 transition-colors" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default function ResourceOutline({ modules, courseId, mode, editable, instructorView, submissionMap }: Props) {
  const supabase = createClient()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [editedResources, setEditedResources] = useState<Map<string, Resource>>(new Map())
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())

  const assignmentHref = (id: string) => instructorView
    ? `/instructor/courses/${courseId}/assignments/${id}/submissions`
    : `/student/courses/${courseId}/assignments/${id}`

  const toggleModule = (id: string) =>
    setCollapsedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const toggleDay = (id: string) =>
    setCollapsedDays(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const sorted = [...modules].sort((a, b) => {
    if (a.week_number !== null && b.week_number !== null) return a.week_number - b.week_number
    return a.order - b.order
  })

  const modulesWithContent = sorted.filter(m =>
    m.module_days.some(d => {
      if (mode === 'resources') return (d.resources ?? []).some(r => !deletedIds.has(r.id))
      return (d.assignments ?? []).filter(a => a.published).length > 0
    })
  )

  const handleDelete = async (resource: Resource) => {
    if (!window.confirm(`Delete "${resource.title}"?`)) return
    setDeletedIds(prev => new Set([...prev, resource.id]))
    const { error } = await supabase.from('resources').delete().eq('id', resource.id)
    if (error) {
      alert(error.message)
      setDeletedIds(prev => { const next = new Set(prev); next.delete(resource.id); return next })
    }
  }

  const handleSave = (updated: Resource) => {
    setEditedResources(prev => new Map(prev).set(updated.id, updated))
  }

  if (modulesWithContent.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text">No content available yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {modulesWithContent.map(module => {
          const moduleCollapsed = collapsedModules.has(module.id)
          const days = [...module.module_days]
            .sort((a, b) => a.order - b.order)
            .filter(d => {
              if (SKIP_DAYS.has(d.day_name)) return false
              if (mode === 'resources') return (d.resources ?? []).some(r => !deletedIds.has(r.id))
              return (d.assignments ?? []).filter(a => a.published).length > 0
            })

          if (days.length === 0) return null

          return (
            <div key={module.id}>
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between mb-3 pb-2 border-b border-border group text-left"
              >
                <h2 className="text-base font-bold text-dark-text">
                  {module.week_number ? `Week ${module.week_number}` : module.title}
                  {module.week_number && (
                    <span className="font-normal text-muted-text ml-2">{module.title}</span>
                  )}
                </h2>
                <span className={`text-xs text-muted-text transition-transform duration-150 ${moduleCollapsed ? '' : 'rotate-180'}`}>▾</span>
              </button>

              {!moduleCollapsed && (
                <div className="flex flex-col gap-4">
                  {days.map(day => {
                    const dayCollapsed = collapsedDays.has(day.id)
                    return (
                      <div key={day.id}>
                        <button
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className="w-full flex items-center justify-between mb-2 px-1 text-left"
                        >
                          <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide">
                            {day.day_name}
                          </h3>
                          <span className={`text-xs text-muted-text transition-transform duration-150 ${dayCollapsed ? '' : 'rotate-180'}`}>▾</span>
                        </button>

                        {!dayCollapsed && mode === 'resources' && (
                          <div className="flex flex-col gap-2">
                            {[...(day.resources ?? [])]
                              .filter(r => !deletedIds.has(r.id))
                              .sort((a, b) => a.order - b.order)
                              .map(r => {
                                const resolved = editedResources.get(r.id) ?? r
                                return resolved.type === 'reading' ? (
                                  <ReadingResource
                                    key={r.id}
                                    resource={resolved}
                                    editable={editable}
                                    onEdit={() => setEditingResource(resolved)}
                                    onDelete={() => handleDelete(resolved)}
                                  />
                                ) : (
                                  <LinkResource
                                    key={r.id}
                                    resource={resolved}
                                    editable={editable}
                                    onEdit={() => setEditingResource(resolved)}
                                    onDelete={() => handleDelete(resolved)}
                                  />
                                )
                              })}
                          </div>
                        )}

                        {!dayCollapsed && mode === 'assignments' && (
                          <div className="flex flex-col gap-2">
                            {(day.assignments ?? []).filter(a => a.published).map(a => (
                              <div
                                key={a.id}
                                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-dark-text">{a.title}</p>
                                  {a.due_date && (
                                    <p className="text-xs text-muted-text mt-0.5">
                                      Due {new Date(a.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                                {submissionMap && (
                                  <AssignmentStatusBadge info={submissionMap[a.id]} />
                                )}
                                {instructorView ? (
                                  <div className="flex items-center gap-3 shrink-0">
                                    <Link
                                      href={`/instructor/courses/${courseId}/assignments/${a.id}`}
                                      className="text-sm text-muted-text hover:text-dark-text font-medium"
                                      prefetch={true}
                                    >
                                      Edit
                                    </Link>
                                    <Link
                                      href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions`}
                                      className="text-sm text-teal-primary font-semibold hover:underline"
                                      prefetch={true}
                                    >
                                      Submissions →
                                    </Link>
                                  </div>
                                ) : (
                                  <Link
                                    href={assignmentHref(a.id)}
                                    className="text-sm text-teal-primary font-semibold hover:underline shrink-0"
                                    prefetch={true}
                                  >
                                    View →
                                  </Link>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editingResource && (
        <EditResourceModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}

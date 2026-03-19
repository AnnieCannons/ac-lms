'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatDueDate, localDate } from '@/lib/date-utils'
import { createClient } from '@/lib/supabase/client'
import { toggleResourceStar, toggleResourceComplete } from '@/lib/resource-actions'
import { trashResource } from '@/lib/trash-actions'
import HtmlContent from '@/components/ui/HtmlContent'
import { normalizeUrl } from '@/lib/url'

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
  category?: string | null
  module_days: Day[]
}

type SubmissionStatus = 'draft' | 'submitted' | 'graded'
type Grade = 'complete' | 'incomplete' | null

interface SubmissionInfo {
  status: SubmissionStatus
  grade: Grade
  hasComments?: boolean
}

interface Props {
  modules: Module[]
  courseId: string
  mode: 'resources' | 'assignments'
  editable?: boolean
  instructorView?: boolean
  submissionMap?: Record<string, SubmissionInfo>
  initialStarredIds?: string[]
  initialCompletedIds?: string[]
}

const SKIP_DAYS_RESOURCES   = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])
const SKIP_DAYS_ASSIGNMENTS = new Set(['Resources', 'Wiki', 'Links'])

function isBonusLike(title?: string, isBonus?: boolean) {
  return isBonus || !!title?.toUpperCase().includes('BONUS')
}

function AssignmentStatusBadge({ info, dueDate, title, isBonus }: { info: SubmissionInfo | undefined; dueDate?: string | null; title?: string; isBonus?: boolean }) {
  const isLate = !!dueDate && localDate(dueDate) < new Date()
  if (info?.grade === 'complete') return <span className="status-complete-btn text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Complete ✓</span>
  if (info?.grade === 'incomplete') return <span className="status-revision-btn text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Needs Revision</span>
  if (info?.status === 'submitted') return (
    <span className="flex items-center gap-1.5 shrink-0">
      {isLate && <span className="status-late-badge text-xs font-semibold px-2.5 py-1 rounded-full border">Late</span>}
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary border border-teal-primary">Turned In</span>
    </span>
  )
  // Bonus assignments: no status badge
  if (isBonusLike(title, isBonus)) return null
  // not started (no submission or draft) — show both Late + Not Started if past due
  return (
    <div className="flex items-center gap-1.5">
      {isLate && <span className="status-late-badge text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Late</span>}
      <span className="status-badge text-xs font-semibold px-2.5 py-1 rounded-full bg-surface border border-muted-text text-dark-text shrink-0">Not Started</span>
    </div>
  )
}

function StarButton({ starred, onToggle }: { starred: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle() }}
      className={`p-1.5 shrink-0 transition-colors ${starred ? 'text-amber-400' : 'text-border hover:text-amber-400'}`}
      aria-label={starred ? 'Remove star' : 'Star this resource'}
      title={starred ? 'Remove star' : 'Star this resource'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  )
}

function CheckButton({ completed, onToggle }: { completed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle() }}
      className={`p-1.5 shrink-0 transition-colors ${completed ? 'text-teal-primary' : 'text-border hover:text-teal-primary'}`}
      aria-label={completed ? 'Mark as unread' : 'Mark as read'}
      title={completed ? 'Mark as unread' : 'Mark as read'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill={completed ? 'var(--color-teal-primary)' : 'none'} stroke={completed ? 'var(--color-teal-primary)' : 'currentColor'} strokeWidth="1.75"/>
        {completed && <path d="M8 12l3 3 5-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </button>
  )
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
  starred,
  completed,
  onEdit,
  onDelete,
  onToggleStar,
  onToggleComplete,
}: {
  resource: Resource
  editable?: boolean
  starred?: boolean
  completed?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onToggleStar?: () => void
  onToggleComplete?: () => void
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
        {onToggleComplete && <CheckButton completed={!!completed} onToggle={onToggleComplete} />}
        {onToggleStar && <StarButton starred={!!starred} onToggle={onToggleStar} />}
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
        <HtmlContent
          html={resource.content}
          className="px-5 py-4 border-t border-border text-sm text-dark-text wiki-content"
        />
      )}
    </div>
  )
}

function LinkResource({
  resource,
  editable,
  starred,
  completed,
  onEdit,
  onDelete,
  onToggleStar,
  onToggleComplete,
}: {
  resource: Resource
  editable?: boolean
  starred?: boolean
  completed?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onToggleStar?: () => void
  onToggleComplete?: () => void
}) {
  return (
    <div className="flex items-center rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors group">
      <a
        href={normalizeUrl(resource.content)}
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
      {onToggleComplete && <CheckButton completed={!!completed} onToggle={onToggleComplete} />}
      {onToggleStar && <StarButton starred={!!starred} onToggle={onToggleStar} />}
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

type AssignmentFilter = 'all' | 'not-started' | 'late' | 'turned-in' | 'needs-revision' | 'complete'

const FILTERS: { key: AssignmentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs-revision', label: 'Needs Revision' },
  { key: 'not-started', label: 'Not Started' },
  { key: 'late', label: 'Late' },
  { key: 'turned-in', label: 'Turned In' },
  { key: 'complete', label: 'Complete ✓' },
]

const FILTER_STYLES: Record<AssignmentFilter, { inactive: string; active: string }> = {
  'all':            { inactive: 'bg-surface border border-muted-text text-dark-text hover:opacity-80', active: 'bg-teal-primary text-white border-2 border-white/40' },
  'not-started':    { inactive: 'bg-surface border border-muted-text text-dark-text hover:opacity-80', active: 'bg-teal-primary text-white border-2 border-white/40' },
  'late':           { inactive: 'bg-amber-500/20 text-amber-700 border border-amber-500 hover:opacity-80', active: 'bg-amber-500 text-white border border-amber-500' },
  'turned-in':      { inactive: 'bg-teal-light text-teal-primary border border-teal-primary hover:opacity-80', active: 'bg-teal-primary text-white border border-teal-primary' },
  'needs-revision': { inactive: 'bg-red-500/20 text-red-500 border border-red-500 hover:opacity-80', active: 'bg-red-500 text-white border border-red-500' },
  'complete':       { inactive: 'bg-green-600/20 text-green-700 border border-green-600 hover:opacity-80', active: 'bg-green-600 text-white border border-green-600' },
}

function matchesFilter(id: string, filter: AssignmentFilter, map: Record<string, SubmissionInfo>, dueDate?: string | null, title?: string, isBonus?: boolean): boolean {
  const info = map[id]
  if (filter === 'all') return true
  if (filter === 'complete') return info?.grade === 'complete'
  if (filter === 'turned-in') return info?.status === 'submitted' && !info?.grade
  const bonus = isBonusLike(title, isBonus)
  const isLate = !!dueDate && localDate(dueDate) < new Date()
  const notStarted = !info || (info.status === 'draft' && !info.grade)
  if (filter === 'needs-revision') return info?.grade === 'incomplete'
  if (bonus && (filter === 'late' || filter === 'not-started')) return false
  if (filter === 'late') return isLate && notStarted
  if (filter === 'not-started') return notStarted
  return true
}

export default function ResourceOutline({
  modules, courseId, mode, editable, instructorView, submissionMap,
  initialStarredIds, initialCompletedIds,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [editedResources, setEditedResources] = useState<Map<string, Resource>>(new Map())
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set(initialStarredIds ?? []))
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set(initialCompletedIds ?? []))
  const moduleKey = `outline-modules-${courseId}-${mode}`
  const dayKey = `outline-days-${courseId}-${mode}`

  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(moduleKey)
      if (saved !== null) return new Set(JSON.parse(saved))
    } catch {}
    return new Set(modules.map(m => m.id))
  })
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(dayKey)
      if (saved !== null) return new Set(JSON.parse(saved))
    } catch {}
    return new Set()
  })
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState<AssignmentFilter>(() => {
    const p = searchParams.get('filter') as AssignmentFilter | null
    return (p && FILTERS.some(f => f.key === p)) ? p : 'all'
  })
  const [search, setSearch] = useState('')
  const [collapsedPastDue, setCollapsedPastDue] = useState(false)
  const [collapsedUpcoming, setCollapsedUpcoming] = useState(false)

  // Save whenever collapse state changes
  useEffect(() => {
    try { localStorage.setItem(moduleKey, JSON.stringify([...collapsedModules])) } catch {}
  }, [collapsedModules])

  useEffect(() => {
    try { localStorage.setItem(dayKey, JSON.stringify([...collapsedDays])) } catch {}
  }, [collapsedDays])

  const allExpanded = collapsedModules.size === 0
  const expandAll = () => {
    setCollapsedModules(new Set())
    setCollapsedDays(new Set())
  }
  const collapseAll = () => {
    setCollapsedModules(new Set(modules.map(m => m.id)))
    setCollapsedDays(new Set(modules.flatMap(m => m.module_days.map((d: { id: string }) => d.id))))
  }

  const changeFilter = (f: AssignmentFilter) => {
    setFilter(f)
    if (f !== 'all') expandAll()
    const params = new URLSearchParams(searchParams.toString())
    if (f === 'all') params.delete('filter')
    else params.set('filter', f)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }

  const toggleStar = async (id: string) => {
    const isStarred = starredIds.has(id)
    setStarredIds(prev => { const next = new Set(prev); isStarred ? next.delete(id) : next.add(id); return next })
    const result = await toggleResourceStar(id, courseId, isStarred)
    if (result?.error) {
      setStarredIds(prev => { const next = new Set(prev); isStarred ? next.add(id) : next.delete(id); return next })
      console.error('Failed to save star:', result.error)
    }
  }

  const toggleComplete = async (id: string) => {
    const isDone = completedIds.has(id)
    setCompletedIds(prev => { const next = new Set(prev); isDone ? next.delete(id) : next.add(id); return next })
    const result = await toggleResourceComplete(id, courseId, isDone)
    if (result?.error) {
      setCompletedIds(prev => { const next = new Set(prev); isDone ? next.add(id) : next.delete(id); return next })
      console.error('Failed to save completion:', result.error)
    }
  }

  const assignmentHref = (id: string) => {
    if (instructorView) return `/instructor/courses/${courseId}/assignments/${id}/submissions`
    const base = `/student/courses/${courseId}/assignments/${id}`
    return filter !== 'all' ? `${base}?filter=${filter}` : base
  }

  const toggleModule = (moduleId: string) => {
    const isCollapsed = collapsedModules.has(moduleId)
    setCollapsedModules(prev => { const next = new Set(prev); isCollapsed ? next.delete(moduleId) : next.add(moduleId); return next })
    // When expanding a module, also expand all its days
    if (isCollapsed) {
      const module = modules.find(m => m.id === moduleId)
      if (module) {
        const dayIds = module.module_days.map((d: { id: string }) => d.id)
        setCollapsedDays(prev => { const next = new Set(prev); dayIds.forEach((id: string) => next.delete(id)); return next })
      }
    }
  }

  const toggleDay = (id: string) =>
    setCollapsedDays(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const sorted = [...modules].sort((a, b) => {
    const aCareer = a.category === 'career'
    const bCareer = b.category === 'career'
    if (aCareer !== bCareer) return aCareer ? 1 : -1
    if (a.week_number !== null && b.week_number !== null) return a.week_number - b.week_number
    return a.order - b.order
  })

  const searchQ = search.trim().toLowerCase()

  const allPublishedAssignments = sorted.flatMap(m =>
    m.module_days.flatMap(d => (d.assignments ?? []).filter(a => a.published).map(a => ({
      ...a,
      moduleTitle: m.title as string,
      weekNumber: m.week_number as number | null,
    })))
  )

  const filterCounts = submissionMap
    ? Object.fromEntries(FILTERS.map(f => [
        f.key,
        f.key === 'all'
          ? allPublishedAssignments.filter(a => !searchQ || a.title.toLowerCase().includes(searchQ)).length
          : allPublishedAssignments.filter(a =>
              matchesFilter(a.id, f.key, submissionMap, a.due_date, a.title) &&
              (!searchQ || a.title.toLowerCase().includes(searchQ))
            ).length,
      ])) as Record<AssignmentFilter, number>
    : null

  // Flat two-section view for "Not Started": Past Due (late) at top, then upcoming
  const sortByDue = (arr: typeof allPublishedAssignments) =>
    arr.slice().sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return localDate(a.due_date).getTime() - localDate(b.due_date).getTime()
    })

  const notStartedFlat = (!instructorView && filter === 'not-started' && submissionMap)
    ? (() => {
        const base = allPublishedAssignments.filter(a => {
          if (isBonusLike(a.title)) return false
          const info = submissionMap[a.id]
          const notStarted = !info || (info.status === 'draft' && !info.grade)
          return notStarted && (!searchQ || a.title.toLowerCase().includes(searchQ))
        })
        const pastDue = sortByDue(base.filter(a => !!a.due_date && localDate(a.due_date) < new Date()))
        const upcoming = sortByDue(base.filter(a => !a.due_date || localDate(a.due_date) >= new Date()))
        return { pastDue, upcoming }
      })()
    : null

  const skipDays = mode === 'assignments' ? SKIP_DAYS_ASSIGNMENTS : SKIP_DAYS_RESOURCES

  const modulesWithContent = sorted.filter(m =>
    m.module_days.some(d => {
      if (skipDays.has(d.day_name)) return false
      if (mode === 'resources') return (d.resources ?? []).some(r =>
        !deletedIds.has(r.id) && (!searchQ || r.title.toLowerCase().includes(searchQ))
      )
      if (instructorView) return searchQ
        ? (d.assignments ?? []).some(a => a.title.toLowerCase().includes(searchQ))
        : true
      const pub = (d.assignments ?? []).filter(a =>
        a.published && (!searchQ || a.title.toLowerCase().includes(searchQ))
      )
      if (!submissionMap || filter === 'all') return pub.length > 0
      return pub.some(a => matchesFilter(a.id, filter, submissionMap, a.due_date, a.title))
    })
  )

  const handleDelete = async (resource: Resource) => {
    if (!window.confirm(`Move "${resource.title}" to trash?`)) return
    setDeletedIds(prev => new Set([...prev, resource.id]))
    const { error } = await trashResource(resource.id, courseId)
    if (error) {
      alert(error)
      setDeletedIds(prev => { const next = new Set(prev); next.delete(resource.id); return next })
    }
  }

  const handleSave = (updated: Resource) => {
    setEditedResources(prev => new Map(prev).set(updated.id, updated))
  }


  const studentActions = !editable && !instructorView

  const searchBar = (
    <div className="relative mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); if (e.target.value) expandAll() }}
        placeholder={mode === 'resources' ? 'Search resources…' : 'Search assignments…'}
        className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
      />
    </div>
  )

  const filterBar = (
    <>
      {searchBar}
      {filterCounts && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.filter(f => instructorView || f.key !== 'late').map(f => {
            const active = filter === f.key
            const styles = FILTER_STYLES[f.key]
            return (
              <button key={f.key} type="button" onClick={() => changeFilter(f.key)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${active ? styles.active : styles.inactive}`}
              >
                {f.label}
                <span className={`ml-1.5 font-normal ${active ? 'opacity-80' : 'opacity-70'}`}>{filterCounts[f.key]}</span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )

  if (modulesWithContent.length === 0) {
    return (
      <>
        {filterBar}
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <p className="text-muted-text">
            {searchQ ? `No results for "${search}".` : filter !== 'all' ? `No assignments match this filter.` : 'No content available yet.'}
          </p>
          {searchQ ? (
            <button type="button" onClick={() => setSearch('')} className="mt-3 text-sm text-teal-primary hover:underline">Clear search</button>
          ) : filter !== 'all' && (
            <button type="button" onClick={() => setFilter('all')} className="mt-3 text-sm text-teal-primary hover:underline">View all assignments</button>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {filterBar}
      {notStartedFlat ? (
        <div className="flex flex-col gap-8">
          {notStartedFlat.pastDue.length === 0 && notStartedFlat.upcoming.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center">
              <p className="text-muted-text text-sm">Nothing here — you&apos;re all caught up!</p>
            </div>
          ) : (
            <>
              {notStartedFlat.pastDue.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setCollapsedPastDue(p => !p)}
                    className="flex items-center gap-2 w-full text-left mb-3 pb-2 border-b border-amber-500/30 group"
                  >
                    <h3 className="text-sm font-semibold text-amber-700">Past Due</h3>
                    <span className="text-xs text-amber-600/70">({notStartedFlat.pastDue.length})</span>
                    <span className="ml-auto text-amber-600/60 group-hover:text-amber-700 transition-colors text-xs">{collapsedPastDue ? '▾' : '▴'}</span>
                  </button>
                  {!collapsedPastDue && (
                    <div className="flex flex-col gap-2">
                      {notStartedFlat.pastDue.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4">
                          <Link href={assignmentHref(a.id)} prefetch={true} className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-text">{a.title}</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                              {a.moduleTitle}{a.weekNumber ? ` · Week ${a.weekNumber}` : ''}
                              {a.due_date ? ` · Due ${formatDueDate(a.due_date)}` : ''}
                            </p>
                          </Link>
                          <AssignmentStatusBadge info={submissionMap?.[a.id]} dueDate={a.due_date} title={a.title} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {notStartedFlat.upcoming.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setCollapsedUpcoming(p => !p)}
                    className="flex items-center gap-2 w-full text-left mb-3 pb-2 border-b border-border group"
                  >
                    <h3 className="text-sm font-semibold text-dark-text">Upcoming</h3>
                    <span className="text-xs text-muted-text">({notStartedFlat.upcoming.length})</span>
                    <span className="ml-auto text-muted-text group-hover:text-dark-text transition-colors text-xs">{collapsedUpcoming ? '▾' : '▴'}</span>
                  </button>
                  {!collapsedUpcoming && (
                    <div className="flex flex-col gap-2">
                      {notStartedFlat.upcoming.map(a => (
                        <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4">
                          <Link href={assignmentHref(a.id)} prefetch={true} className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-dark-text">{a.title}</p>
                            <p className="text-xs text-muted-text mt-0.5">
                              {a.moduleTitle}{a.weekNumber ? ` · Week ${a.weekNumber}` : ''}
                              {a.due_date ? ` · Due ${formatDueDate(a.due_date)}` : ''}
                            </p>
                          </Link>
                          <AssignmentStatusBadge info={submissionMap?.[a.id]} dueDate={a.due_date} title={a.title} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-xs font-medium text-muted-text hover:text-teal-primary transition-colors"
            >
              {allExpanded ? 'Collapse All ▴' : 'Expand All ▾'}
            </button>
          </div>
          <div className="flex flex-col gap-6">
            {modulesWithContent.map(module => {
          const moduleCollapsed = collapsedModules.has(module.id)
          const days = [...module.module_days]
            .sort((a, b) => a.order - b.order)
            .filter(d => {
              if (skipDays.has(d.day_name)) return false
              if (mode === 'resources') return (d.resources ?? []).some(r =>
                !deletedIds.has(r.id) && (!searchQ || r.title.toLowerCase().includes(searchQ))
              )
              if (instructorView) return searchQ
                ? (d.assignments ?? []).some(a => a.title.toLowerCase().includes(searchQ))
                : true
              const pub = (d.assignments ?? []).filter(a =>
                a.published && (!searchQ || a.title.toLowerCase().includes(searchQ))
              )
              if (!submissionMap) return pub.length > 0
              if (filter === 'all') return pub.length > 0
              return pub.some(a => matchesFilter(a.id, filter, submissionMap, a.due_date, a.title))
            })

          if (days.length === 0) return null

          return (
            <div key={module.id}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <button
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  className="flex items-center gap-2 text-left"
                >
                  <h2 className="text-base font-bold text-dark-text">{module.title}</h2>
                  <span className={`text-xs text-muted-text transition-transform duration-150 ${moduleCollapsed ? '' : 'rotate-180'}`}>▾</span>
                </button>
              </div>

              {!moduleCollapsed && (
                <div className="flex flex-col gap-4">
                  {days.map(day => {
                    const dayCollapsed = collapsedDays.has(day.id)
                    const visibleAssignments = (day.assignments ?? [])
                      .filter(a =>
                        instructorView
                          ? (!searchQ || a.title.toLowerCase().includes(searchQ))
                          : (a.published &&
                             (!searchQ || a.title.toLowerCase().includes(searchQ)) &&
                             (!submissionMap || filter === 'all' || matchesFilter(a.id, filter, submissionMap, a.due_date, a.title)))
                      )
                      .sort((a, b) => {
                        // In not-started view, sort late assignments first
                        if (!instructorView && filter === 'not-started') {
                          const aLate = !!a.due_date && localDate(a.due_date) < new Date()
                          const bLate = !!b.due_date && localDate(b.due_date) < new Date()
                          if (aLate && !bLate) return -1
                          if (!aLate && bLate) return 1
                        }
                        return 0
                      })
                    return (
                      <div key={day.id}>
                        <button
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className="w-full flex items-center justify-between mb-2 pl-3 pr-1 text-left"
                        >
                          <h3 className="text-xs font-semibold text-dark-text uppercase tracking-wide">
                            {day.day_name}
                          </h3>
                          <span className={`text-xs text-muted-text transition-transform duration-150 ${dayCollapsed ? '' : 'rotate-180'}`}>▾</span>
                        </button>

                        {!dayCollapsed && mode === 'resources' && (
                          <div className="flex flex-col gap-2 pl-3">
                            {[...(day.resources ?? [])]
                              .filter(r => !deletedIds.has(r.id) && (!searchQ || r.title.toLowerCase().includes(searchQ)))
                              .sort((a, b) => a.order - b.order)
                              .map(r => {
                                const resolved = editedResources.get(r.id) ?? r
                                return resolved.type === 'reading' ? (
                                  <ReadingResource
                                    key={r.id}
                                    resource={resolved}
                                    editable={editable}
                                    starred={starredIds.has(r.id)}
                                    completed={completedIds.has(r.id)}
                                    onToggleStar={studentActions ? () => toggleStar(r.id) : undefined}
                                    onToggleComplete={studentActions ? () => toggleComplete(r.id) : undefined}
                                    onEdit={() => setEditingResource(resolved)}
                                    onDelete={() => handleDelete(resolved)}
                                  />
                                ) : (
                                  <LinkResource
                                    key={r.id}
                                    resource={resolved}
                                    editable={editable}
                                    starred={starredIds.has(r.id)}
                                    completed={completedIds.has(r.id)}
                                    onToggleStar={studentActions ? () => toggleStar(r.id) : undefined}
                                    onToggleComplete={studentActions ? () => toggleComplete(r.id) : undefined}
                                    onEdit={() => setEditingResource(resolved)}
                                    onDelete={() => handleDelete(resolved)}
                                  />
                                )
                              })}
                          </div>
                        )}

                        {!dayCollapsed && mode === 'assignments' && (
                          <div className="flex flex-col gap-2 pl-3">
                            {!instructorView && visibleAssignments.length === 0 ? (
                              <p className="text-xs text-muted-text py-2 pl-1">No assignments on {day.day_name.toLowerCase()}.</p>
                            ) : visibleAssignments.map(a => instructorView ? (
                              <div
                                key={a.id}
                                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-dark-text">{a.title}</p>
                                    {!a.published && (
                                      <span className="text-[10px] font-bold bg-muted-text/20 text-muted-text px-1.5 py-0.5 rounded-full leading-none shrink-0">Draft</span>
                                    )}
                                  </div>
                                  {a.due_date && (
                                    <p className="text-xs text-muted-text mt-0.5">
                                      Due {formatDueDate(a.due_date)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Link
                                    href={`/instructor/courses/${courseId}/assignments/${a.id}?edit=1`}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-muted-text hover:border-dark-text hover:text-dark-text transition-colors"
                                    prefetch={true}
                                  >
                                    Edit
                                  </Link>
                                  <Link
                                    href={`/instructor/courses/${courseId}/assignments/${a.id}/submissions`}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-primary text-purple-primary hover:bg-purple-light transition-colors"
                                    prefetch={true}
                                  >
                                    Submissions →
                                  </Link>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={a.id}
                                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4"
                              >
                                <Link href={assignmentHref(a.id)} prefetch={true} className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-dark-text">{a.title}</p>
                                  {a.due_date && (() => {
                                    const isPast = localDate(a.due_date) < new Date()
                                    const info = submissionMap?.[a.id]
                                    const isResolved = info?.grade === 'complete' || info?.grade === 'incomplete' || info?.status === 'submitted'
                                    return (
                                      <p className={`text-xs font-medium mt-0.5 ${isPast && !isResolved ? 'text-amber-600' : 'text-muted-text'}`}>
                                        Due {formatDueDate(a.due_date)}
                                      </p>
                                    )
                                  })()}
                                </Link>
                                <div className="flex items-center gap-2 shrink-0">
                                  {submissionMap?.[a.id]?.hasComments && (
                                    <Link
                                      href={`${assignmentHref(a.id)}#comments`}
                                      prefetch={false}
                                      title="View instructor comment"
                                      className="text-teal-primary hover:text-teal-primary/70 transition-colors"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                      </svg>
                                    </Link>
                                  )}
                                  {submissionMap && (
                                    <AssignmentStatusBadge info={submissionMap[a.id]} dueDate={a.due_date} title={a.title} />
                                  )}
                                </div>
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
        </>
      )}

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

'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDueDate } from '@/lib/date-utils'
import { toggleResourceStar, toggleResourceComplete } from '@/lib/resource-actions'
import HtmlContent from '@/components/ui/HtmlContent'
import WikiView from '@/components/ui/WikiView'

const RESOURCE_ICONS: Record<string, string> = {
  video: '▶',
  reading: '📖',
  link: '🔗',
  file: '📄',
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

function ReadingResource({
  resource,
  starred,
  completed,
  onToggleStar,
  onToggleComplete,
}: {
  resource: { id: string; title: string; content: string | null; description: string | null; careerDev?: boolean }
  starred: boolean
  completed: boolean
  onToggleStar: () => void
  onToggleComplete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-border/10 transition-colors text-left min-w-0"
        >
          <span className="text-base shrink-0">{RESOURCE_ICONS.reading}</span>
          <p className="flex-1 text-sm font-medium text-dark-text">{resource.title}</p>
          {resource.careerDev && (
            <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Career Dev</span>
          )}
          <span className={`text-xs text-muted-text shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <CheckButton completed={completed} onToggle={onToggleComplete} />
        <StarButton starred={starred} onToggle={onToggleStar} />
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

interface Resource {
  id: string
  type: string
  title: string
  content: string | null
  description: string | null
  order: number
  careerDev?: boolean
}

interface Assignment {
  id: string
  title: string
  due_date: string | null
  published: boolean
  order?: number | null
  skill_tags?: string[] | null
  is_bonus?: boolean
  careerDev?: boolean
}

interface Quiz {
  id: string
  title: string
  module_title: string
  day_title: string | null
  linked_day_id?: string | null
  max_attempts: number | null
  due_at: string | null
}

interface Day {
  id: string
  day_name: string
  order: number
  assignments: Assignment[]
  resources: Resource[]
}

interface WikiItem {
  id: string
  title: string
  content: string
}

interface Module {
  id: string
  title: string
  week_number: number | null
  order: number
  module_days: Day[]
  wikis?: WikiItem[]
}

type SubmissionInfo = { status: 'draft' | 'submitted' | 'graded'; grade: 'complete' | 'incomplete' | null }

function AssignmentStatusBadge({ info, dueDate }: { info: SubmissionInfo | undefined; dueDate?: string | null }) {
  const isLate = !!dueDate && new Date(dueDate) < new Date()
  if (info?.grade === 'complete') return <span className="status-complete-btn text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Complete ✓</span>
  if (info?.grade === 'incomplete') return <span className="status-revision-btn text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Needs Revision</span>
  if (info?.status === 'submitted') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary border border-teal-primary shrink-0">Turned In</span>
  // not started (no submission or draft) — show both Late + Not Started if past due
  return (
    <div className="flex items-center gap-1.5">
      {isLate && <span className="status-late-badge text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0">Late</span>}
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not Started</span>
    </div>
  )
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  modules: Module[]
  courseId: string
  currentWeek: number | null
  submissionMap?: Record<string, SubmissionInfo>
  initialStarredIds?: string[]
  initialCompletedIds?: string[]
  hideLevelUpBanner?: boolean
  showBonusAssignments?: boolean
  quizzes?: Quiz[]
  showSearch?: boolean
}

function DayContent({
  day,
  courseId,
  submissionMap,
  starredIds,
  completedIds,
  onToggleStar,
  onToggleComplete,
  showBonusAssignments,
  quizzesForDay,
}: {
  day: Day
  courseId: string
  submissionMap?: Record<string, SubmissionInfo>
  starredIds: Set<string>
  completedIds: Set<string>
  onToggleStar: (id: string) => void
  onToggleComplete: (id: string) => void
  showBonusAssignments?: boolean
  quizzesForDay: Quiz[]
}) {
  const publishedAssignments = [...(day.assignments ?? [])]
    .filter(a => a.published && (showBonusAssignments || !a.is_bonus))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const resources = [...(day.resources ?? [])].sort((a, b) => a.order - b.order)
  const hasContent = publishedAssignments.length > 0 || resources.length > 0 || quizzesForDay.length > 0

  return (
    <div className="px-4 py-5 flex flex-col gap-6 border-t border-border bg-background">
      {/* Resources */}
      {resources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">Resources</p>
          <div className="flex flex-col gap-2">
            {resources.map(r =>
              r.type === 'reading' ? (
                <ReadingResource
                  key={r.id}
                  resource={r}
                  starred={starredIds.has(r.id)}
                  completed={completedIds.has(r.id)}
                  onToggleStar={() => onToggleStar(r.id)}
                  onToggleComplete={() => onToggleComplete(r.id)}
                />
              ) : (
                <div key={r.id} className="flex items-center rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors group">
                  <a
                    href={r.content ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0"
                  >
                    <span className="text-base shrink-0">{RESOURCE_ICONS[r.type] ?? '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-text group-hover:text-teal-primary transition-colors">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-text mt-0.5">{r.description}</p>}
                    </div>
                    {r.careerDev && (
                      <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Career Dev</span>
                    )}
                    <span className="text-xs text-muted-text shrink-0 group-hover:text-teal-primary">↗</span>
                  </a>
                  <CheckButton completed={completedIds.has(r.id)} onToggle={() => onToggleComplete(r.id)} />
                  <StarButton starred={starredIds.has(r.id)} onToggle={() => onToggleStar(r.id)} />
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Assignments */}
      {publishedAssignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">Assignments</p>
          <div className="flex flex-col gap-2">
            {publishedAssignments.map(a => (
              <div
                key={a.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-dark-text">{a.title}</p>
                    {a.is_bonus && (
                      <span className="text-xs font-medium bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-2 py-0.5">Bonus</span>
                    )}
                    {a.careerDev && (
                      <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5">Career Dev</span>
                    )}
                  </div>
                  {(a.skill_tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(a.skill_tags ?? []).map(tag => (
                        <span key={tag} className="text-xs bg-teal-light text-teal-primary border border-teal-primary/30 rounded-full px-2 py-0.5">{tag}</span>
                      ))}
                    </div>
                  )}
                  {a.due_date && (
                    <p className="text-xs text-muted-text mt-0.5">
                      Due {formatDueDate(a.due_date)}
                    </p>
                  )}
                </div>
                {submissionMap && <AssignmentStatusBadge info={submissionMap[a.id]} dueDate={a.due_date} />}
                <Link
                  href={`/student/courses/${courseId}/assignments/${a.id}`}
                  className="text-sm text-teal-primary font-semibold hover:underline shrink-0"
                  prefetch={true}
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quizzes */}
      {quizzesForDay.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-3">Quizzes</p>
          <div className="flex flex-col gap-2">
            {quizzesForDay.map(quiz => {
              const displayTitle = quiz.title.startsWith('Quiz: ') ? quiz.title.slice(6) : quiz.title
              const isCrossPosted = !!quiz.linked_day_id && quiz.linked_day_id === day.id
              return (
                <div key={quiz.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-dark-text">{displayTitle}</p>
                      {isCrossPosted && (
                        <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5">Career Dev</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/student/courses/${courseId}/quizzes/${quiz.id}`}
                    className="text-sm text-teal-primary font-semibold hover:underline shrink-0"
                  >
                    Take →
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && (
        <p className="text-sm text-muted-text text-center py-4">Nothing scheduled for this day yet.</p>
      )}
    </div>
  )
}

type SearchResult =
  | { kind: 'module'; module: Module }
  | { kind: 'day'; module: Module; day: Day }
  | { kind: 'assignment'; module: Module; day: Day; assignment: Assignment }
  | { kind: 'resource'; module: Module; day: Day; resource: Resource }
  | { kind: 'quiz'; quiz: Quiz }

export default function CourseOutlineAccordion({
  modules, courseId, currentWeek, submissionMap,
  initialStarredIds, initialCompletedIds, hideLevelUpBanner, showBonusAssignments, quizzes,
  showSearch = true,
}: Props) {
  const todayName = DAY_NAMES[new Date().getDay()]
  const [search, setSearch] = useState('')
  const [openDayIds, setOpenDayIds] = useState<Set<string>>(new Set())
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())
  const toggleModule = (id: string) =>
    setCollapsedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleDay = (id: string) =>
    setOpenDayIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const expandAll = () => setCollapsedModules(new Set())
  const collapseAll = () => setCollapsedModules(new Set(modules.map(m => m.id)))

  const expandDayInline = (moduleId: string, dayId: string) => {
    setSearch('')
    setCollapsedModules(prev => { const next = new Set(prev); next.delete(moduleId); return next })
    setOpenDayIds(prev => { const next = new Set(prev); next.add(dayId); return next })
  }

  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set(initialStarredIds ?? []))
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set(initialCompletedIds ?? []))

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

  const query = search.trim().toLowerCase()
  const searchResults: SearchResult[] | null = query ? (() => {
    const results: SearchResult[] = []
    for (const module of modules) {
      if (module.title.toLowerCase().includes(query)) results.push({ kind: 'module', module })
      for (const day of [...(module.module_days ?? [])].sort((a, b) => a.order - b.order)) {
        if (day.day_name.toLowerCase().includes(query)) results.push({ kind: 'day', module, day })
        for (const a of day.assignments ?? []) {
          if (a.published && a.title.toLowerCase().includes(query)) results.push({ kind: 'assignment', module, day, assignment: a })
        }
        for (const r of day.resources ?? []) {
          if (r.title.toLowerCase().includes(query)) results.push({ kind: 'resource', module, day, resource: r })
        }
      }
    }
    for (const quiz of quizzes ?? []) {
      const displayTitle = quiz.title.startsWith('Quiz: ') ? quiz.title.slice(6) : quiz.title
      if (displayTitle.toLowerCase().includes(query)) results.push({ kind: 'quiz', quiz })
    }
    return results
  })() : null

  return (
    <>
      {/* Search bar */}
      {showSearch && <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="search"
          placeholder="Search modules, days, assignments, resources…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
      </div>}

      {/* Search results */}
      {searchResults !== null ? (
        <div className="flex flex-col gap-2">
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-text text-center py-10">No results for &ldquo;{search}&rdquo;</p>
          ) : (
            searchResults.map((result, i) => {
              if (result.kind === 'module') return (
                <div key={`m-${result.module.id}-${i}`} className="bg-surface rounded-2xl border border-border px-6 py-4">
                  <p className="text-xs text-muted-text uppercase tracking-wide font-semibold mb-0.5">Module</p>
                  <p className="font-semibold text-dark-text">{result.module.title}</p>
                </div>
              )
              if (result.kind === 'day') return (
                <button key={`d-${result.day.id}-${i}`} type="button"
                  onClick={() => expandDayInline(result.module.id, result.day.id)}
                  className="bg-surface rounded-xl border border-border px-4 py-3 text-left hover:border-teal-primary/40 hover:bg-teal-light/20 transition-colors w-full"
                >
                  <p className="text-xs text-muted-text mb-0.5">{result.module.title}</p>
                  <p className="text-sm font-medium text-dark-text">{result.day.day_name}</p>
                </button>
              )
              if (result.kind === 'assignment') return (
                <div key={`a-${result.assignment.id}-${i}`} className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-text mb-0.5">{result.module.title} · {result.day.day_name}</p>
                    <p className="text-sm font-medium text-dark-text truncate">{result.assignment.title}</p>
                  </div>
                  <Link href={`/student/courses/${courseId}/assignments/${result.assignment.id}`}
                    className="text-sm text-teal-primary font-semibold hover:underline shrink-0">
                    View →
                  </Link>
                </div>
              )
              if (result.kind === 'resource') return (
                <div key={`r-${result.resource.id}-${i}`} className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-text mb-0.5">{result.module.title} · {result.day.day_name}</p>
                    <p className="text-sm font-medium text-dark-text truncate">{result.resource.title}</p>
                  </div>
                  {result.resource.content ? (
                    <a href={result.resource.content} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-teal-primary font-semibold hover:underline shrink-0">
                      Open ↗
                    </a>
                  ) : (
                    <button type="button" onClick={() => expandDayInline(result.module.id, result.day.id)}
                      className="text-sm text-teal-primary font-semibold hover:underline shrink-0">
                      View →
                    </button>
                  )}
                </div>
              )
              if (result.kind === 'quiz') {
                const displayTitle = result.quiz.title.startsWith('Quiz: ') ? result.quiz.title.slice(6) : result.quiz.title
                return (
                  <div key={`q-${result.quiz.id}-${i}`} className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-text mb-0.5">Quiz</p>
                      <p className="text-sm font-medium text-dark-text truncate">{displayTitle}</p>
                    </div>
                    <Link href={`/student/courses/${courseId}/quizzes/${result.quiz.id}`}
                      className="text-sm text-teal-primary font-semibold hover:underline shrink-0">
                      Take →
                    </Link>
                  </div>
                )
              }
              return null
            })
          )}
        </div>
      ) : (
      <>
      {modules.length > 1 && (
        <div className="flex justify-end gap-2 mb-2">
          <button type="button" onClick={expandAll} className="text-xs text-muted-text hover:text-dark-text transition-colors">Expand all</button>
          <span className="text-xs text-border">·</span>
          <button type="button" onClick={collapseAll} className="text-xs text-muted-text hover:text-dark-text transition-colors">Collapse all</button>
        </div>
      )}
      <div className="flex flex-col gap-6">
        {modules.map(module => {
          const isCurrentWeek = currentWeek !== null && module.week_number === currentWeek
          const sortedDays = [...(module.module_days ?? [])].sort((a, b) => a.order - b.order)

          const moduleCollapsed = collapsedModules.has(module.id)

          return (
            <div
              key={module.id}
              id={module.week_number ? `week-${module.week_number}` : undefined}
              className={`bg-surface rounded-2xl border transition-colors ${
                isCurrentWeek ? 'border-teal-primary shadow-sm' : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-dark-text">{module.title}</h3>
                  {isCurrentWeek && (
                    <span className="bg-teal-light text-teal-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                      Current Week
                    </span>
                  )}
                </div>
                <span className={`text-xs text-muted-text transition-transform duration-150 shrink-0 ${moduleCollapsed ? '' : 'rotate-180'}`}>▾</span>
              </button>

              {!moduleCollapsed && (module.wikis ?? []).length > 0 && (
                <div className="flex flex-col gap-2 px-6 pb-2">
                  {(module.wikis ?? []).map(wiki => (
                    <WikiView key={wiki.id} wiki={wiki} />
                  ))}
                </div>
              )}

              {!moduleCollapsed && sortedDays.length > 0 && (
                <div className="flex flex-col gap-2 px-6 pb-6">
                  {sortedDays.map(day => {
                    const isToday = isCurrentWeek && day.day_name === todayName
                    const publishedAssignments = [...(day.assignments?.filter(a => a.published && (showBonusAssignments || !a.is_bonus)) ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    const resources = day.resources ?? []
                    const dayQuizzes = (quizzes ?? []).filter(q => {
                      if (q.linked_day_id === day.id) return true
                      if (q.day_title?.trim() !== day.day_name?.trim()) return false
                      if (q.module_title?.trim() === module.title?.trim()) return true
                      const quizWeek = q.module_title?.match(/^Week\s+(\d+)/i)?.[1]
                      return !!(quizWeek && module.week_number === parseInt(quizWeek, 10))
                    })
                    const total = publishedAssignments.length + resources.length + dayQuizzes.length
                    const isDayOpen = openDayIds.has(day.id)

                    return (
                      <div
                        key={day.id}
                        className={`rounded-xl border overflow-hidden transition-colors ${
                          isToday ? 'border-teal-primary' : 'border-border'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                            isToday
                              ? 'bg-teal-light hover:bg-teal-light/70'
                              : 'bg-background hover:bg-border/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${isToday ? 'text-teal-primary' : 'text-dark-text'}`}>
                              {day.day_name}
                            </span>
                            {isToday && (
                              <span className="text-xs text-teal-primary font-semibold">Today</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {total > 0 && !isDayOpen && (
                              <span className="text-xs text-muted-text">
                                {[
                                  publishedAssignments.length > 0 && `${publishedAssignments.length} assignment${publishedAssignments.length !== 1 ? 's' : ''}`,
                                  resources.length > 0 && `${resources.length} resource${resources.length !== 1 ? 's' : ''}`,
                                  dayQuizzes.length > 0 && `${dayQuizzes.length} quiz${dayQuizzes.length !== 1 ? 'zes' : ''}`,
                                ].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            <span className={`text-xs text-muted-text transition-transform duration-150 ${isDayOpen ? 'rotate-180' : ''}`}>▾</span>
                          </div>
                        </button>

                        {isDayOpen && (
                          <DayContent
                            day={day}
                            courseId={courseId}
                            submissionMap={submissionMap}
                            starredIds={starredIds}
                            completedIds={completedIds}
                            onToggleStar={toggleStar}
                            onToggleComplete={toggleComplete}
                            showBonusAssignments={showBonusAssignments}
                            quizzesForDay={dayQuizzes}
                          />
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

      {!hideLevelUpBanner && (
        <div className="bg-purple-light rounded-xl px-4 py-4 mt-2">
          <p className="text-sm font-semibold text-purple-primary">Done with today&apos;s work?</p>
          <p className="text-sm text-muted-text mt-1">
            Head over to{' '}
            <Link href={`/student/courses/${courseId}/level-up`} className="text-teal-primary font-medium hover:underline">
              Level Up Your Skills
            </Link>
            {' '}for extra challenges and bonus content.
          </p>
        </div>
      )}
      </>
      )}
    </>
  )
}

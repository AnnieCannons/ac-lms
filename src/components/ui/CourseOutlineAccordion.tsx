'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toggleResourceStar, toggleResourceComplete } from '@/lib/resource-actions'

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
  resource: { id: string; title: string; content: string | null; description: string | null }
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
          <span className={`text-xs text-muted-text shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <CheckButton completed={completed} onToggle={onToggleComplete} />
        <StarButton starred={starred} onToggle={onToggleStar} />
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
  assignments: Assignment[]
  resources: Resource[]
}

interface Module {
  id: string
  title: string
  week_number: number | null
  order: number
  module_days: Day[]
}

type SubmissionInfo = { status: 'draft' | 'submitted' | 'graded'; grade: 'complete' | 'incomplete' | null }

function AssignmentStatusBadge({ info, dueDate }: { info: SubmissionInfo | undefined; dueDate?: string | null }) {
  const isLate = !info && !!dueDate && new Date(dueDate) < new Date()
  if (!info) return isLate
    ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-500 shrink-0">Late</span>
    : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not Started</span>
  if (info.grade === 'complete') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-600 shrink-0">Complete ✓</span>
  if (info.grade === 'incomplete') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-500 border border-red-500 shrink-0">Needs Revision</span>
  if (info.status === 'submitted') return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-light text-teal-primary border border-teal-primary shrink-0">Turned In</span>
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border border-border text-muted-text shrink-0">Not Started</span>
}

interface Props {
  modules: Module[]
  courseId: string
  currentWeek: number | null
  todayName: string
  submissionMap?: Record<string, SubmissionInfo>
  initialStarredIds?: string[]
  initialCompletedIds?: string[]
  hideLevelUpBanner?: boolean
}

function DayModal({
  module,
  day,
  courseId,
  isToday,
  onClose,
  submissionMap,
  starredIds,
  completedIds,
  onToggleStar,
  onToggleComplete,
  hideLevelUpBanner,
}: {
  module: Module
  day: Day
  courseId: string
  isToday: boolean
  onClose: () => void
  submissionMap?: Record<string, SubmissionInfo>
  starredIds: Set<string>
  completedIds: Set<string>
  onToggleStar: (id: string) => void
  onToggleComplete: (id: string) => void
  hideLevelUpBanner?: boolean
}) {
  const publishedAssignments = (day.assignments ?? []).filter(a => a.published)
  const resources = [...(day.resources ?? [])].sort((a, b) => a.order - b.order)
  const hasContent = publishedAssignments.length > 0 || resources.length > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-12 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full sm:max-w-2xl rounded-2xl shadow-2xl mb-12"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-start justify-between px-6 py-5 border-b border-border rounded-t-2xl ${isToday ? 'bg-teal-light' : ''}`}>
          <div>
            <p className="text-xs text-muted-text mb-0.5">{module.title}</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-dark-text">{day.day_name}</h2>
              {isToday && (
                <span className="text-xs text-teal-primary font-semibold bg-white px-2 py-0.5 rounded-full">Today</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-dark-text text-xl leading-none mt-1 shrink-0"
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-8">
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
                      <p className="text-sm font-medium text-dark-text">{a.title}</p>
                      {a.due_date && (
                        <p className="text-xs text-muted-text mt-0.5">
                          Due {new Date(a.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
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

          {/* Empty state */}
          {!hasContent && (
            <p className="text-sm text-muted-text text-center py-6">Nothing scheduled for this day yet.</p>
          )}

          {/* Level Up note */}
          {!hideLevelUpBanner && (
            <div className="bg-purple-light rounded-xl px-4 py-4">
              <p className="text-sm font-semibold text-purple-primary">Done with today's work?</p>
              <p className="text-sm text-muted-text mt-1">
                Head over to{' '}
                <Link
                  href={`/student/courses/${courseId}/level-up`}
                  className="text-teal-primary font-medium hover:underline"
                  onClick={onClose}
                >
                  Level Up Your Skills
                </Link>
                {' '}for extra challenges and bonus content.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CourseOutlineAccordion({
  modules, courseId, currentWeek, todayName, submissionMap,
  initialStarredIds, initialCompletedIds, hideLevelUpBanner,
}: Props) {
  const [openDay, setOpenDay] = useState<{ day: Day; module: Module } | null>(null)
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())
  const toggleModule = (id: string) =>
    setCollapsedModules(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const expandAll = () => setCollapsedModules(new Set())
  const collapseAll = () => setCollapsedModules(new Set(modules.map(m => m.id)))

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

  return (
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

              {!moduleCollapsed && sortedDays.length > 0 && (
                <div className="flex flex-col gap-2 px-6 pb-6">
                  {sortedDays.map(day => {
                    const isToday = isCurrentWeek && day.day_name === todayName
                    const publishedAssignments = day.assignments?.filter(a => a.published) ?? []
                    const resources = day.resources ?? []
                    const total = publishedAssignments.length + resources.length

                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setOpenDay({ day, module })}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                          isToday
                            ? 'border-teal-primary bg-teal-light hover:bg-teal-light/70'
                            : 'border-border bg-background hover:bg-border/10'
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
                          {total > 0 && (
                            <span className="text-xs text-muted-text">
                              {[
                                publishedAssignments.length > 0 && `${publishedAssignments.length} assignment${publishedAssignments.length !== 1 ? 's' : ''}`,
                                resources.length > 0 && `${resources.length} resource${resources.length !== 1 ? 's' : ''}`,
                              ].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          <span className="text-xs text-muted-text">›</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {openDay && (
        <DayModal
          module={openDay.module}
          day={openDay.day}
          courseId={courseId}
          isToday={currentWeek !== null && openDay.module.week_number === currentWeek && openDay.day.day_name === todayName}
          onClose={() => setOpenDay(null)}
          submissionMap={submissionMap}
          starredIds={starredIds}
          completedIds={completedIds}
          onToggleStar={toggleStar}
          onToggleComplete={toggleComplete}
          hideLevelUpBanner={hideLevelUpBanner}
        />
      )}
    </>
  )
}

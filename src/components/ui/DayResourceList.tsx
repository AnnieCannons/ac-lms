'use client'
import { useState } from 'react'
import { toggleResourceStar, toggleResourceComplete } from '@/lib/resource-actions'
import HtmlContent from '@/components/ui/HtmlContent'

interface Resource {
  id: string
  type: string
  title: string
  content: string | null
  description: string | null
  careerDev?: boolean
}

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
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
      className={`p-1.5 shrink-0 transition-colors ${starred ? 'text-amber-400' : 'text-border hover:text-amber-400'}`}
      aria-label={starred ? 'Remove star' : 'Star this resource'}
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
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
      className={`p-1.5 shrink-0 transition-colors ${completed ? 'text-teal-primary' : 'text-border hover:text-teal-primary'}`}
      aria-label={completed ? 'Mark as unread' : 'Mark as read'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill={completed ? 'var(--color-teal-primary)' : 'none'} stroke={completed ? 'var(--color-teal-primary)' : 'currentColor'} strokeWidth="1.75"/>
        {completed && <path d="M8 12l3 3 5-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </button>
  )
}

export default function DayResourceList({
  resources,
  courseId,
  initialStarredIds,
  initialCompletedIds,
}: {
  resources: Resource[]
  courseId: string
  initialStarredIds: string[]
  initialCompletedIds: string[]
}) {
  const [starredIds, setStarredIds] = useState(() => new Set(initialStarredIds))
  const [completedIds, setCompletedIds] = useState(() => new Set(initialCompletedIds))
  const [openReadings, setOpenReadings] = useState<Set<string>>(new Set())

  const toggleStar = async (id: string) => {
    const isStarred = starredIds.has(id)
    setStarredIds(prev => { const next = new Set(prev); isStarred ? next.delete(id) : next.add(id); return next })
    const result = await toggleResourceStar(id, courseId, isStarred)
    if (result?.error) {
      setStarredIds(prev => { const next = new Set(prev); isStarred ? next.add(id) : next.delete(id); return next })
    }
  }

  const toggleComplete = async (id: string) => {
    const isDone = completedIds.has(id)
    setCompletedIds(prev => { const next = new Set(prev); isDone ? next.delete(id) : next.add(id); return next })
    const result = await toggleResourceComplete(id, courseId, isDone)
    if (result?.error) {
      setCompletedIds(prev => { const next = new Set(prev); isDone ? next.add(id) : next.delete(id); return next })
    }
  }

  const toggleReading = (id: string) =>
    setOpenReadings(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  return (
    <div className="flex flex-col gap-2">
      {resources.map(resource => {
        const starred = starredIds.has(resource.id)
        const completed = completedIds.has(resource.id)

        if (resource.type === 'reading') {
          const open = openReadings.has(resource.id)
          return (
            <div key={resource.id} className="rounded-xl border border-border overflow-hidden group">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggleReading(resource.id)}
                  className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-border/10 transition-colors text-left min-w-0"
                >
                  <span className="text-base shrink-0">{RESOURCE_ICONS.reading}</span>
                  <p className="flex-1 font-medium text-dark-text">{resource.title}</p>
                  {resource.careerDev && (
                    <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Career Dev</span>
                  )}
                  <span className={`text-xs text-muted-text shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
                </button>
                <CheckButton completed={completed} onToggle={() => toggleComplete(resource.id)} />
                <StarButton starred={starred} onToggle={() => toggleStar(resource.id)} />
              </div>
              {open && resource.content && (
                <HtmlContent
                  html={resource.content}
                  className="px-5 py-4 border-t border-border text-dark-text wiki-content"
                />
              )}
            </div>
          )
        }

        return (
          <div key={resource.id} className="flex items-center rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors group">
            <a
              href={resource.content ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0"
            >
              <span className="text-base shrink-0">{RESOURCE_ICONS[resource.type] ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dark-text group-hover:text-teal-primary transition-colors">{resource.title}</p>
                {resource.description && <p className="text-sm text-muted-text mt-0.5">{resource.description}</p>}
              </div>
              {resource.careerDev && (
                <span className="text-xs font-medium bg-purple-light text-purple-primary rounded px-1.5 py-0.5 shrink-0">Career Dev</span>
              )}
              <span className="text-xs text-muted-text shrink-0 group-hover:text-teal-primary">↗</span>
            </a>
            <CheckButton completed={completed} onToggle={() => toggleComplete(resource.id)} />
            <StarButton starred={starred} onToggle={() => toggleStar(resource.id)} />
          </div>
        )
      })}
    </div>
  )
}

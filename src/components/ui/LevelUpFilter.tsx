'use client'
import { useState } from 'react'
import CourseOutlineAccordion from './CourseOutlineAccordion'

type Module = Parameters<typeof CourseOutlineAccordion>[0]['modules'][number] & {
  skill_tags?: string[] | null
}

interface Props {
  modules: Module[]
  courseId: string
}

function moduleMatchesSearch(m: Module, q: string): boolean {
  if (!q) return true
  if (m.title.toLowerCase().includes(q)) return true
  if ((m.skill_tags ?? []).some(t => t.toLowerCase().includes(q))) return true
  return (m.module_days ?? []).some(d =>
    (d.assignments ?? []).some(a => a.title.toLowerCase().includes(q)) ||
    (d.resources ?? []).some(r => r.title.toLowerCase().includes(q))
  )
}

export default function LevelUpFilter({ modules, courseId }: Props) {
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const allTags = Array.from(
    new Set(modules.flatMap(m => m.skill_tags ?? []))
  ).sort()

  const searchQ = search.trim().toLowerCase()

  const filtered = modules
    .filter(m => !activeTag || m.skill_tags?.includes(activeTag))
    .filter(m => moduleMatchesSearch(m, searchQ))

  return (
    <div>
      <div className="relative mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search Level Up…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              !activeTag
                ? 'bg-teal-primary text-white border-teal-primary'
                : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                activeTag === tag
                  ? 'bg-teal-primary text-white border-teal-primary'
                  : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <CourseOutlineAccordion
          modules={filtered}
          courseId={courseId}
          currentWeek={null}
          hideLevelUpBanner
          showBonusAssignments
          showSearch={false}
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <p className="text-muted-text">
            {searchQ ? `No results for "${search}".` : `No content tagged with "${activeTag}".`}
          </p>
          {searchQ && (
            <button type="button" onClick={() => setSearch('')} className="mt-3 text-sm text-teal-primary hover:underline">
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  )
}

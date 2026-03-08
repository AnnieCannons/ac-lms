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

export default function LevelUpFilter({ modules, courseId }: Props) {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const allTags = Array.from(
    new Set(modules.flatMap(m => m.skill_tags ?? []))
  ).sort()

  const filtered = activeTag
    ? modules.filter(m => m.skill_tags?.includes(activeTag))
    : modules

  return (
    <div>
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
          todayName=""
          hideLevelUpBanner
          showBonusAssignments
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <p className="text-muted-text">No content tagged with &ldquo;{activeTag}&rdquo;.</p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { moveRovingFocus } from '@/lib/roving-focus'
import SkillTrendCard from '@/components/ui/SkillTrendCard'
import { ChevronDown } from 'lucide-react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import SkillMultiSelect from '@/components/ui/SkillMultiSelect'
import WhatHelpedPatterns from '@/components/ui/WhatHelpedPatterns'
import { computeClassPatterns } from '@/lib/confidence-patterns'
import { currentCourseScore, type SkillTrend } from '@/lib/confidence-trend'
import type { CourseTrendSkill, CourseTrendStudent } from '@/lib/confidence-trend-data'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function formatStat(v: number | null): string {
  if (v === null) return '–'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function SkillOverviewCard({ skill }: { skill: CourseTrendSkill }) {
  const { stats } = skill
  const max = Math.max(...stats.distribution, 1)
  // The ten bars are one Tab stop (arrow keys move between them), not ten: with many skills
  // the overview would otherwise have hundreds of stops.
  const [activeBar, setActiveBar] = useState(0)
  const label = `Distribution of latest ratings: ${stats.distribution
    .map((count, i) => (count > 0 ? `${i + 1} (${plural(count, 'student')})` : ''))
    .filter(Boolean)
    .join(', ')}`
  return (
    <div className="bg-surface border-2 border-border rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-dark-text">{skill.name}</h3>
        <span className="text-xs text-muted-text">{plural(stats.n, 'student')} rated</span>
      </div>
      <p className="mt-1 text-xs text-dark-text">
        Average <strong>{formatStat(stats.average)}</strong> · Median <strong>{formatStat(stats.median)}</strong>
      </p>
      <div
        role="group"
        aria-label={label}
        className="mt-3 flex items-end gap-1 h-16"
        onKeyDown={e => { const next = moveRovingFocus(e, '[data-bar]'); if (next !== null) setActiveBar(next) }}
      >
        {stats.distribution.map((count, i) => {
          // Keep the pop-up inside the card at the two ends of the scale.
          const align = i < 3 ? 'left-0' : i > 6 ? 'right-0' : 'left-1/2 -translate-x-1/2'
          return (
            <div
              key={i}
              data-bar
              tabIndex={i === activeBar ? 0 : -1}
              onFocus={() => setActiveBar(i)}
              aria-label={`${plural(count, 'student')} rated ${i + 1}`}
              className="group relative flex-1 flex flex-col items-center justify-end h-full outline-none"
            >
              <span
                role="tooltip"
                className={`pointer-events-none absolute bottom-full mb-1 ${align} z-10 hidden whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-dark-text shadow group-hover:block group-focus:block`}
              >
                {plural(count, 'student')}
              </span>
              <div
                className="w-full rounded-t bg-teal-primary group-hover:opacity-80"
                style={{ height: count > 0 ? `${Math.max((count / max) * 100, 8)}%` : '2px', opacity: count > 0 ? 1 : 0.25 }}
              />
              <span className="mt-1 text-[10px] text-muted-text">{i + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// One of the two parts inside an expanded student row. A native details element, so it is keyboard and
// screen-reader accessible, and closed to begin with so a student's row opens to a short list.
function CollapsiblePart({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-bold text-dark-text">
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-text transition-transform group-not-open:-rotate-90" />
        <span>{title}</span>
        {count !== undefined && <span className="font-light text-muted-text">{count}</span>}
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  )
}

function StudentRow({ student, skillIds, sort, open, onToggle }: {
  student: CourseTrendStudent
  // Skills picked in the filter; empty means all skills.
  skillIds: string[]
  sort: SortKey
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const trends = skillIds.length === 0 ? student.trends : student.trends.filter(t => skillIds.includes(t.skillId))
  // The skill cards follow the page's Sort too: by name, or by the latest rating each card shows.
  const orderedTrends = [...trends].sort(compareBy<SkillTrend>(sort, t => t.name, { rating: t => t.latestRating, recent: t => lastRatedAt(t, false) }))

  if (trends.length === 0) {
    return (
      <li className="bg-surface border border-border rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2">
        <span className="font-medium text-dark-text">{student.name}</span>
        <span className="text-sm text-muted-text">{skillIds.length === 0 ? 'No ratings yet' : skillIds.length === 1 ? 'No ratings for this skill' : 'No ratings for these skills'}</span>
      </li>
    )
  }

  return (
    <li className="bg-surface border border-border rounded-xl">
      <details open={open} onToggle={e => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer px-4 py-3 flex flex-wrap justify-between gap-2">
          <span className="font-medium text-dark-text">{student.name}</span>
          <span className="text-sm text-muted-text">{plural(trends.length, 'skill')} rated</span>
        </summary>
        {open && (
          <div className="px-4 pb-4 space-y-3">
            <CollapsiblePart title="What tends to help this student">
              <WhatHelpedPatterns trends={trends} audience="student" compact />
            </CollapsiblePart>
            <CollapsiblePart title="Skills" count={trends.length}>
              <div className="space-y-4">
                {orderedTrends.map(t => <SkillTrendCard key={t.skillId} trend={t} showCourseContext collapsible />)}
              </div>
            </CollapsiblePart>
          </div>
        )}
      </details>
    </li>
  )
}

type SortKey = 'recent-desc' | 'recent-asc' | 'name-asc' | 'name-desc' | 'rating-asc' | 'rating-desc'
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent-desc', label: 'Most recent first' },
  { value: 'recent-asc', label: 'Least recent first' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'rating-asc', label: 'Rating low to high' },
  { value: 'rating-desc', label: 'Rating high to low' },
]

// When a skill was last rated, as a timestamp (ratings are in date order), or null if it has none.
// `currentCourseOnly` leaves out ratings from earlier courses, which are context here, not activity.
function lastRatedAt(trend: SkillTrend, currentCourseOnly: boolean): number | null {
  const ratings = currentCourseOnly ? trend.ratings.filter(r => r.isCurrentCourse) : trend.ratings
  return ratings.length === 0 ? null : Date.parse(ratings[ratings.length - 1].date)
}

const latestOf = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : Math.max(...present)
}

// Order by name, by the rating, or by when it was last rated; "-asc" is low to high or least recent
// first. Anything without a score goes last either way, then by name.
function compareBy<T>(sort: SortKey, name: (x: T) => string, scores: { rating: (x: T) => number | null; recent: (x: T) => number | null }) {
  return (a: T, b: T) => {
    if (sort === 'name-asc') return name(a).localeCompare(name(b))
    if (sort === 'name-desc') return name(b).localeCompare(name(a))
    const score = sort.startsWith('recent') ? scores.recent : scores.rating
    const sa = score(a)
    const sb = score(b)
    if (sa === null && sb === null) return name(a).localeCompare(name(b))
    if (sa === null) return 1
    if (sb === null) return -1
    return (sort.endsWith('-asc') ? sa - sb : sb - sa) || name(a).localeCompare(name(b))
  }
}

type Tab = 'overview' | 'students' | 'patterns'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Class overview' },
  { id: 'students', label: 'By student' },
  { id: 'patterns', label: 'Patterns' },
]

export default function SkillConfidenceInstructorView({ students, skills }: { students: CourseTrendStudent[]; skills: CourseTrendSkill[] }) {
  const [tab, setTab] = useState<Tab>('overview')
  // Skills picked in the filter; empty means all skills.
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [studentFilter, setStudentFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('recent-desc')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // Only skills with a rating from this course (the ones the class overview has a card for), so the
  // filter never offers a skill that would just say "no ratings". A skill a student rated only in an
  // earlier course still shows in their expanded row under "All skills".
  const skillOptions = skills.map(s => ({ id: s.id, name: s.name }))
  const studentOptions = students.map(s => ({ value: s.id, label: s.name }))

  const trendsInView = (s: CourseTrendStudent) => (skillIds.length === 0 ? s.trends : s.trends.filter(t => skillIds.includes(t.skillId)))
  // When each skill was last rated by anyone in the class (this course only), for "most recent" order.
  const skillLastRated = new Map<string, number>()
  for (const student of students) {
    for (const t of student.trends) {
      const at = lastRatedAt(t, true)
      if (at !== null && at > (skillLastRated.get(t.skillId) ?? -Infinity)) skillLastRated.set(t.skillId, at)
    }
  }
  // Skill cards rank by the class average; students rank by the mean of their latest ratings in view.
  const visibleSkills = [...(skillIds.length === 0 ? skills : skills.filter(s => skillIds.includes(s.id)))]
    .sort(compareBy<CourseTrendSkill>(sort, s => s.name, { rating: s => s.stats.average, recent: s => skillLastRated.get(s.id) ?? null }))
  const visibleStudents = [...(studentFilter === 'all' ? students : students.filter(s => s.id === studentFilter))]
    .sort(compareBy<CourseTrendStudent>(sort, s => s.name, {
      rating: s => currentCourseScore(trendsInView(s)),
      recent: s => latestOf(trendsInView(s).map(t => lastRatedAt(t, true))),
    }))
  const expandable = visibleStudents.filter(s => trendsInView(s).length > 0)

  // Class-level patterns: every student's skills in view (the skill filter applies, the student filter
  // does not), so the counts always cover the whole class.
  const classPatterns = computeClassPatterns(students.map(trendsInView))

  if (students.length === 0) {
    return <p className="text-sm text-muted-text">No students are currently enrolled in this course.</p>
  }

  const selectClass = 'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text'
  const setRowOpen = (id: string, open: boolean) =>
    setOpenIds(prev => {
      if (prev.has(id) === open) return prev
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const at = TABS.findIndex(t => t.id === tab)
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    const next = TABS[to].id
    setTab(next)
    document.getElementById(`skill-tab-${next}`)?.focus()
  }

  const sortField = (
    <label className="text-sm text-muted-text">
      Sort{' '}
      {/* A native select, drawn with the same chevron as the searchable dropdowns beside it. */}
      <span className="relative inline-block">
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className={`${selectClass} w-44 appearance-none py-2 pl-3 pr-9`}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
      </span>
    </label>
  )

  const skillFilterField = (
    <div className="w-full sm:w-96">
      <SkillMultiSelect label="Skills" inlineLabel placeholder="All skills" options={skillOptions} selectedIds={skillIds} onChange={setSkillIds} />
    </div>
  )

  return (
    <div>
      <div role="tablist" aria-label="Confidence views" className="flex gap-0 sm:gap-1 overflow-x-auto pb-px sm:overflow-visible sm:pb-0 border-b border-border" onKeyDown={onTabKeyDown}>
        {TABS.map(t => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              id={`skill-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`skill-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`-mb-px px-1.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                selected ? 'border-teal-primary text-teal-primary' : 'border-transparent text-muted-text hover:text-dark-text'
              }`}
            >
              {t.label}
              {t.id === 'students' && <span className="ml-1.5 font-light">{students.length}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <div role="tabpanel" id="skill-panel-overview" aria-labelledby="skill-tab-overview" className="pt-6 space-y-6">
          <div className="flex flex-wrap items-start gap-4">{skillFilterField}{sortField}</div>
          {visibleSkills.length === 0 ? (
            <p className="text-sm text-muted-text">No students have rated {skillIds.length === 0 ? 'a skill' : skillIds.length === 1 ? 'this skill' : 'these skills'} on this course yet.</p>
          ) : (
            // Columns follow the width the cards actually have (the sidebar takes a share of the screen):
            // one when narrow, two from 28rem, three from 42rem.
            <div className="@container">
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @2xl:grid-cols-3">
                {visibleSkills.map(s => <SkillOverviewCard key={s.id} skill={s} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'students' && (
        <div role="tabpanel" id="skill-panel-students" aria-labelledby="skill-tab-students" className="pt-6 space-y-6">
          <div className="flex flex-wrap items-start gap-4">
            {skillFilterField}
            <SearchableSelect label="Student" allLabel="All students" options={studentOptions} value={studentFilter} onChange={setStudentFilter} widthClass="w-44" />
            {sortField}
          </div>
          {expandable.length > 0 && (
            <div className="flex justify-end gap-4 text-sm font-medium text-teal-primary">
              <button type="button" className="hover:underline" onClick={() => setOpenIds(new Set(expandable.map(s => s.id)))}>Expand all</button>
              <button type="button" className="hover:underline" onClick={() => setOpenIds(new Set())}>Collapse all</button>
            </div>
          )}
          <ul className="space-y-2">
            {visibleStudents.map(s => (
              <StudentRow key={s.id} student={s} skillIds={skillIds} sort={sort} open={openIds.has(s.id)} onToggle={o => setRowOpen(s.id, o)} />
            ))}
          </ul>
        </div>
      )}

      {tab === 'patterns' && (
        <div role="tabpanel" id="skill-panel-patterns" aria-labelledby="skill-tab-patterns" className="pt-6 space-y-6">
          <div className="flex flex-wrap gap-4">{skillFilterField}</div>
          <WhatHelpedPatterns patterns={classPatterns} audience="class" />
        </div>
      )}
    </div>
  )
}

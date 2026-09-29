'use client'

import { useState } from 'react'
import SkillTrendCard from '@/components/ui/SkillTrendCard'
import { ChevronDown } from 'lucide-react'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { currentCourseScore } from '@/lib/confidence-trend'
import type { CourseTrendSkill, CourseTrendStudent } from '@/lib/confidence-trend-data'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function formatStat(v: number | null): string {
  if (v === null) return '–'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function SkillOverviewCard({ skill }: { skill: CourseTrendSkill }) {
  const { stats } = skill
  const max = Math.max(...stats.distribution, 1)
  const label = `Distribution of latest ratings: ${stats.distribution
    .map((count, i) => (count > 0 ? `${i + 1} (${plural(count, 'student')})` : ''))
    .filter(Boolean)
    .join(', ')}`
  return (
    <div className="bg-surface border-2 border-border rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold text-dark-text">{skill.name}</h3>
        <span className="text-sm text-muted-text">{plural(stats.n, 'student')} rated</span>
      </div>
      <p className="mt-1 text-sm text-dark-text">
        Average <strong>{formatStat(stats.average)}</strong> · Median <strong>{formatStat(stats.median)}</strong>
      </p>
      <div role="group" aria-label={label} className="mt-3 flex items-end gap-1 h-16">
        {stats.distribution.map((count, i) => {
          // Keep the pop-up inside the card at the two ends of the scale.
          const align = i < 3 ? 'left-0' : i > 6 ? 'right-0' : 'left-1/2 -translate-x-1/2'
          return (
            <div
              key={i}
              tabIndex={0}
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

function StudentRow({ student, skillFilter, open, onToggle }: {
  student: CourseTrendStudent
  skillFilter: string
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const trends = skillFilter === 'all' ? student.trends : student.trends.filter(t => t.skillId === skillFilter)

  if (trends.length === 0) {
    return (
      <li className="bg-surface border border-border rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2">
        <span className="font-medium text-dark-text">{student.name}</span>
        <span className="text-sm text-muted-text">{skillFilter === 'all' ? 'No ratings yet' : 'No ratings for this skill'}</span>
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
          <div className="px-4 pb-4 space-y-4">
            {trends.map(t => <SkillTrendCard key={t.skillId} trend={t} showCourseContext />)}
          </div>
        )}
      </details>
    </li>
  )
}

type SortKey = 'name-asc' | 'name-desc' | 'rating-asc' | 'rating-desc'
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'rating-asc', label: 'Rating low to high' },
  { value: 'rating-desc', label: 'Rating high to low' },
]

// Ascending or descending by a score; anything without a score goes last either way, then by name.
function compareBy<T>(sort: SortKey, name: (x: T) => string, score: (x: T) => number | null) {
  return (a: T, b: T) => {
    if (sort === 'name-asc') return name(a).localeCompare(name(b))
    if (sort === 'name-desc') return name(b).localeCompare(name(a))
    const sa = score(a)
    const sb = score(b)
    if (sa === null && sb === null) return name(a).localeCompare(name(b))
    if (sa === null) return 1
    if (sb === null) return -1
    return (sort === 'rating-asc' ? sa - sb : sb - sa) || name(a).localeCompare(name(b))
  }
}

type Tab = 'overview' | 'students'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Class overview' },
  { id: 'students', label: 'By student' },
]

export default function SkillConfidenceInstructorView({ students, skills }: { students: CourseTrendStudent[]; skills: CourseTrendSkill[] }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [skillFilter, setSkillFilter] = useState('all')
  const [studentFilter, setStudentFilter] = useState('all')
  const [sort, setSort] = useState<SortKey>('name-asc')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // Only skills with a rating from this course (the ones the class overview has a card for), so the
  // filter never offers a skill that would just say "no ratings". A skill a student rated only in an
  // earlier course still shows in their expanded row under "All skills".
  const skillOptions = skills.map(s => ({ value: s.id, label: s.name }))
  const studentOptions = students.map(s => ({ value: s.id, label: s.name }))

  const trendsInView = (s: CourseTrendStudent) => (skillFilter === 'all' ? s.trends : s.trends.filter(t => t.skillId === skillFilter))
  // Skill cards rank by the class average; students rank by the mean of their latest ratings in view.
  const visibleSkills = [...(skillFilter === 'all' ? skills : skills.filter(s => s.id === skillFilter))]
    .sort(compareBy<CourseTrendSkill>(sort, s => s.name, s => s.stats.average))
  const visibleStudents = [...(studentFilter === 'all' ? students : students.filter(s => s.id === studentFilter))]
    .sort(compareBy<CourseTrendStudent>(sort, s => s.name, s => currentCourseScore(trendsInView(s))))
  const expandable = visibleStudents.filter(s => (skillFilter === 'all' ? s.trends : s.trends.filter(t => t.skillId === skillFilter)).length > 0)

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
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next: Tab = tab === 'overview' ? 'students' : 'overview'
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
    <SearchableSelect label="Skill" allLabel="All skills" options={skillOptions} value={skillFilter} onChange={setSkillFilter} widthClass="w-48" />
  )

  return (
    <div>
      <div role="tablist" aria-label="Confidence views" className="flex gap-1 border-b border-border" onKeyDown={onTabKeyDown}>
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
              className={`-mb-px px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
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
          <div className="flex flex-wrap gap-4">{skillFilterField}{sortField}</div>
          {visibleSkills.length === 0 ? (
            <p className="text-sm text-muted-text">No students have rated {skillFilter === 'all' ? 'a skill' : 'this skill'} on this course yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleSkills.map(s => <SkillOverviewCard key={s.id} skill={s} />)}
            </div>
          )}
        </div>
      )}

      {tab === 'students' && (
        <div role="tabpanel" id="skill-panel-students" aria-labelledby="skill-tab-students" className="pt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
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
              <StudentRow key={s.id} student={s} skillFilter={skillFilter} open={openIds.has(s.id)} onToggle={o => setRowOpen(s.id, o)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import SkillTrendCard from '@/components/ui/SkillTrendCard'
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
      <div role="img" aria-label={label} className="mt-3 flex items-end gap-1 h-16">
        {stats.distribution.map((count, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t bg-teal-primary"
              style={{ height: count > 0 ? `${Math.max((count / max) * 100, 8)}%` : '2px', opacity: count > 0 ? 1 : 0.25 }}
            />
            <span className="mt-1 text-[10px] text-muted-text">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudentRow({ student, skillFilter }: { student: CourseTrendStudent; skillFilter: string }) {
  const [open, setOpen] = useState(false)
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
      <details onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
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

export default function SkillConfidenceInstructorView({ students, skills }: { students: CourseTrendStudent[]; skills: CourseTrendSkill[] }) {
  const [skillFilter, setSkillFilter] = useState('all')
  const [studentFilter, setStudentFilter] = useState('all')

  // A student can hold ratings for a skill that the class overview omits (e.g. only earlier-course ratings).
  const skillOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const s of skills) byId.set(s.id, s.name)
    for (const st of students) for (const t of st.trends) byId.set(t.skillId, t.name)
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [skills, students])

  const visibleSkills = skillFilter === 'all' ? skills : skills.filter(s => s.id === skillFilter)
  const visibleStudents = studentFilter === 'all' ? students : students.filter(s => s.id === studentFilter)

  if (students.length === 0) {
    return <p className="text-sm text-muted-text">No students are currently enrolled in this course.</p>
  }

  const selectClass = 'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text'

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-4">
        <label className="text-sm text-muted-text">
          Skill{' '}
          <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)} className={selectClass}>
            <option value="all">All skills</option>
            {skillOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted-text">
          Student{' '}
          <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className={selectClass}>
            <option value="all">All students</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <section aria-labelledby="class-overview">
        <h2 id="class-overview" className="text-lg font-bold text-dark-text mb-4">Class overview</h2>
        {visibleSkills.length === 0 ? (
          <p className="text-sm text-muted-text">No students have rated {skillFilter === 'all' ? 'a skill' : 'this skill'} on this course yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleSkills.map(s => <SkillOverviewCard key={s.id} skill={s} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="students-heading">
        <h2 id="students-heading" className="text-lg font-bold text-dark-text mb-4">Students</h2>
        <ul className="space-y-2">
          {visibleStudents.map(s => <StudentRow key={s.id} student={s} skillFilter={skillFilter} />)}
        </ul>
      </section>
    </div>
  )
}

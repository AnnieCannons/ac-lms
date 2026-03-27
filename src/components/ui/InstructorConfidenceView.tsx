'use client'

import { useState } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

interface StudentSkillEntry {
  score: number
  created_at: string
}

interface StudentRow {
  id: string
  name: string
  skills: Record<string, StudentSkillEntry[]>
  isPast: boolean
}

interface Props {
  students: StudentRow[]
  skillNames: string[]
}

function scoreColor(score: number): string {
  if (score <= 2) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  if (score <= 4) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
  if (score <= 6) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
  if (score <= 8) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  return 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
}

function scoreTextColor(score: number): string {
  if (score <= 2) return 'text-red-600 dark:text-red-400'
  if (score <= 4) return 'text-orange-600 dark:text-orange-400'
  if (score <= 6) return 'text-yellow-600 dark:text-yellow-500'
  if (score <= 8) return 'text-green-600 dark:text-green-400'
  return 'text-teal-600 dark:text-teal-400'
}

function latestScore(entries: StudentSkillEntry[] | undefined): number | null {
  if (!entries?.length) return null
  return entries[entries.length - 1].score
}

function avgOf(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function Sparkline({ entries, color = 'var(--color-teal-primary)' }: { entries: StudentSkillEntry[]; color?: string }) {
  const data = entries.map(e => ({ v: e.score }))
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <YAxis domain={[0, 10]} hide />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={data.length <= 6 ? { r: 2, fill: color, strokeWidth: 0 } : false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Skill detail panel ─────────────────────────────────────────────────────────

function SkillDetailPanel({ skill, students }: { skill: string; students: StudentRow[] }) {
  const withData = students
    .map(s => ({ student: s, entries: s.skills[skill] ?? [] }))
    .filter(r => r.entries.length > 0)
    .sort((a, b) => {
      const la = latestScore(a.entries)!
      const lb = latestScore(b.entries)!
      return la - lb // lowest first
    })

  const withoutData = students.filter(s => !s.skills[skill]?.length)

  if (withData.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-muted-text">No students have logged <strong>{skill}</strong> yet.</p>
    )
  }

  const avg = avgOf(withData.map(r => latestScore(r.entries)!))

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-text">Class average:</span>
        <span className={`text-lg font-bold ${scoreTextColor(avg)}`}>{avg.toFixed(1)}</span>
        <span className="text-xs text-muted-text">· {withData.length} student{withData.length !== 1 ? 's' : ''} tracking this skill</span>
        {withoutData.length > 0 && (
          <span className="text-xs text-muted-text">· {withoutData.length} not tracking</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {withData.map(({ student, entries }) => {
          const score = latestScore(entries)!
          const gain = entries.length > 1 ? score - entries[0].score : null
          return (
            <div key={student.id} className="rounded-xl border border-border bg-background p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-dark-text truncate">{student.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {gain !== null && gain > 0 && (
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">+{gain}</span>
                  )}
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${scoreColor(score)}`}>
                    {score}/10
                  </span>
                </div>
              </div>
              {entries.length > 1 ? (
                <Sparkline entries={entries} color={score <= 4 ? '#ef4444' : score <= 6 ? '#f59e0b' : '#1AA5A5'} />
              ) : (
                <p className="text-xs text-muted-text py-2">1 entry logged</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Student cards ──────────────────────────────────────────────────────────────

function StudentCard({ student, skillNames }: { student: StudentRow; skillNames: string[] }) {
  const trackedSkills = skillNames.filter(n => student.skills[n]?.length > 0)

  if (trackedSkills.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 opacity-40">
        <p className="text-sm font-semibold text-dark-text truncate">{student.name}</p>
        <p className="text-xs text-muted-text mt-1">No entries yet</p>
      </div>
    )
  }

  const scores = trackedSkills.map(n => latestScore(student.skills[n])!)
  const avg = avgOf(scores)

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-dark-text truncate">{student.name}</p>
        <span className={`text-sm font-bold shrink-0 ${scoreTextColor(avg)}`}>{avg.toFixed(1)} avg</span>
      </div>
      <div className="flex flex-col gap-2">
        {trackedSkills.map(name => {
          const entries = student.skills[name]
          const score = latestScore(entries)!
          const gain = entries.length > 1 ? score - entries[0].score : null
          return (
            <div key={name} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-text truncate">{name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {gain !== null && gain > 0 && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">+{gain}</span>
                  )}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${scoreColor(score)}`}>{score}</span>
                </div>
              </div>
              <Sparkline entries={entries} color={score <= 4 ? '#ef4444' : score <= 6 ? '#f59e0b' : '#1AA5A5'} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function InstructorConfidenceView({ students, skillNames }: Props) {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  const current = students.filter(s => !s.isPast)
  const past = students.filter(s => s.isPast)

  if (skillNames.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text text-sm">No skills tracked yet. Students can add skills from the Confidence Tracker in their Tools menu.</p>
      </div>
    )
  }

  // Skill summary sorted lowest avg first
  const skillSummaries = skillNames
    .map(name => {
      const scores = current
        .map(s => latestScore(s.skills[name]))
        .filter((s): s is number => s !== null)
      const avg = scores.length ? avgOf(scores) : null
      return { name, avg, count: scores.length }
    })
    .sort((a, b) => {
      if (a.avg === null && b.avg === null) return a.name.localeCompare(b.name)
      if (a.avg === null) return 1
      if (b.avg === null) return -1
      return a.avg - b.avg
    })

  // Sort students: those with data first (by avg asc), no-data last
  const sortedCurrent = [...current].sort((a, b) => {
    const scoresA = skillNames.map(n => latestScore(a.skills[n])).filter((s): s is number => s !== null)
    const scoresB = skillNames.map(n => latestScore(b.skills[n])).filter((s): s is number => s !== null)
    if (!scoresA.length && !scoresB.length) return a.name.localeCompare(b.name)
    if (!scoresA.length) return 1
    if (!scoresB.length) return -1
    return avgOf(scoresA) - avgOf(scoresB)
  })

  return (
    <div className="flex flex-col gap-6">

      {/* Skill summary — clickable */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-dark-text">Skills by average score</p>
          <p className="text-xs text-muted-text mt-0.5">Sorted lowest → highest · click a skill to see student detail</p>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          {skillSummaries.map(({ name, avg, count }) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedSkill(selectedSkill === name ? null : name)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors text-left ${
                selectedSkill === name
                  ? 'border-teal-primary bg-teal-light'
                  : 'border-border bg-background hover:border-teal-primary/50'
              }`}
            >
              <span className="text-sm font-medium text-dark-text">{name}</span>
              {avg !== null ? (
                <>
                  <span className={`text-sm font-bold ${scoreTextColor(avg)}`}>{avg.toFixed(1)}</span>
                  <span className="text-xs text-muted-text">({count})</span>
                </>
              ) : (
                <span className="text-xs text-muted-text">no data</span>
              )}
              <span aria-hidden="true" className="text-xs text-muted-text">{selectedSkill === name ? '▲' : '▼'}</span>
            </button>
          ))}
        </div>

        {/* Skill detail panel */}
        {selectedSkill && (
          <div className="border-t border-border">
            <div className="px-5 py-3 bg-background/50 flex items-center justify-between">
              <p className="text-sm font-semibold text-dark-text">{selectedSkill}</p>
              <button
                type="button"
                onClick={() => setSelectedSkill(null)}
                className="text-muted-text hover:text-dark-text text-lg leading-none"
                aria-label="Close detail"
              >✕</button>
            </div>
            <SkillDetailPanel skill={selectedSkill} students={current} />
          </div>
        )}
      </div>

      {/* Student cards */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-dark-text">{current.length} enrolled students</p>
          <p className="text-xs text-muted-text">Sorted by average · no-data students faded</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCurrent.map(student => (
            <StudentCard key={student.id} student={student} skillNames={skillNames} />
          ))}
        </div>
      </div>

      {/* Past students */}
      {past.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setPastOpen(o => !o)}
            aria-expanded={pastOpen}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-background/50 transition-colors"
          >
            <p className="text-sm font-semibold text-dark-text">{past.length} past student{past.length !== 1 ? 's' : ''}</p>
            <span aria-hidden="true" className="text-muted-text text-xs">{pastOpen ? '▲' : '▼'}</span>
          </button>
          {pastOpen && (
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {past.map(student => (
                <StudentCard key={student.id} student={student} skillNames={skillNames} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

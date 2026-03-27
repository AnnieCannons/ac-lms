'use client'

import { useState } from 'react'

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

function avgColor(score: number): string {
  if (score <= 2) return 'text-red-600 dark:text-red-400'
  if (score <= 4) return 'text-orange-600 dark:text-orange-400'
  if (score <= 6) return 'text-yellow-600 dark:text-yellow-500'
  if (score <= 8) return 'text-green-600 dark:text-green-400'
  return 'text-teal-600 dark:text-teal-400'
}

function latestScore(entries: StudentSkillEntry[] | undefined): number | null {
  if (!entries || entries.length === 0) return null
  return entries[entries.length - 1].score
}

function studentAvg(student: StudentRow, skillNames: string[]): number | null {
  const scores = skillNames.map(n => latestScore(student.skills[n])).filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function skillAvg(students: StudentRow[], skill: string): { avg: number; count: number } | null {
  const scores = students.map(s => latestScore(s.skills[skill])).filter((s): s is number => s !== null)
  if (scores.length === 0) return null
  return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length }
}

function ScoreCell({ entries }: { entries: StudentSkillEntry[] | undefined }) {
  const score = latestScore(entries)
  if (score === null) return <td className="px-3 py-2.5 text-center text-border text-sm">–</td>
  return (
    <td className="px-3 py-2.5 text-center">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${scoreColor(score)}`}>
        {score}
      </span>
    </td>
  )
}

function StudentTable({ students, skillNames }: { students: StudentRow[]; skillNames: string[] }) {
  if (students.length === 0) return null

  // Sort by average score ascending (struggling first), nulls last
  const sorted = [...students].sort((a, b) => {
    const avgA = studentAvg(a, skillNames)
    const avgB = studentAvg(b, skillNames)
    if (avgA === null && avgB === null) return a.name.localeCompare(b.name)
    if (avgA === null) return 1
    if (avgB === null) return -1
    return avgA - avgB
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2.5 font-semibold text-dark-text whitespace-nowrap min-w-[160px]">Student</th>
            <th className="px-3 py-2.5 font-semibold text-dark-text text-center whitespace-nowrap">Avg</th>
            {skillNames.map(name => (
              <th key={name} className="px-3 py-2.5 font-semibold text-dark-text whitespace-nowrap text-center max-w-[120px]">
                <span className="block truncate" title={name}>{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(student => {
            const avg = studentAvg(student, skillNames)
            return (
              <tr key={student.id} className={`border-b border-border/50 transition-colors ${avg !== null ? 'hover:bg-background/50' : 'opacity-50'}`}>
                <td className="px-3 py-2.5 font-medium text-dark-text whitespace-nowrap">{student.name}</td>
                <td className="px-3 py-2.5 text-center">
                  {avg !== null
                    ? <span className={`font-bold text-sm ${avgColor(avg)}`}>{avg.toFixed(1)}</span>
                    : <span className="text-border text-sm">–</span>
                  }
                </td>
                {skillNames.map(name => (
                  <ScoreCell key={name} entries={student.skills[name]} />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function InstructorConfidenceView({ students, skillNames }: Props) {
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

  // Skill summary sorted by avg ascending (most struggle first)
  const skillSummaries = skillNames
    .map(name => ({ name, stat: skillAvg(current, name) }))
    .sort((a, b) => {
      if (!a.stat && !b.stat) return a.name.localeCompare(b.name)
      if (!a.stat) return 1
      if (!b.stat) return -1
      return a.stat.avg - b.stat.avg
    })

  const studentsWithData = current.filter(s => studentAvg(s, skillNames) !== null)

  return (
    <div className="flex flex-col gap-6">

      {/* Skill difficulty summary */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-dark-text">Skills by average score</p>
          <p className="text-xs text-muted-text mt-0.5">Sorted lowest → highest · only includes students who have logged that skill</p>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          {skillSummaries.map(({ name, stat }) => (
            <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background">
              <span className="text-sm font-medium text-dark-text">{name}</span>
              {stat ? (
                <>
                  <span className={`text-sm font-bold ${avgColor(stat.avg)}`}>{stat.avg.toFixed(1)}</span>
                  <span className="text-xs text-muted-text">({stat.count} student{stat.count !== 1 ? 's' : ''})</span>
                </>
              ) : (
                <span className="text-xs text-muted-text">no data</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Student grid */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-dark-text">{current.length} enrolled student{current.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-muted-text mt-0.5">Sorted by average score · students with no data shown at bottom</p>
          </div>
          <span className="text-xs text-muted-text shrink-0">{studentsWithData.length} have logged data</span>
        </div>
        {current.length > 0 ? (
          <StudentTable students={current} skillNames={skillNames} />
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-text">No enrolled students yet.</p>
        )}
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
          {pastOpen && <StudentTable students={past} skillNames={skillNames} />}
        </div>
      )}
    </div>
  )
}

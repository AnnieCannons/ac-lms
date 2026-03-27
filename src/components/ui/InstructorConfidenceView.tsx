'use client'

import { useState } from 'react'

interface StudentSkillEntry {
  score: number
  created_at: string
}

interface StudentRow {
  id: string
  name: string
  skills: Record<string, StudentSkillEntry[]> // normalized skill name → entries
  isPast: boolean
}

interface Props {
  students: StudentRow[]
  skillNames: string[] // unique normalized names, display form (first seen)
}

const SCORE_COLOR: Record<number, string> = {
  1: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  2: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  3: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  4: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  5: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  6: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  7: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  8: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  9: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  10: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}

function ScoreCell({ entries }: { entries: StudentSkillEntry[] | undefined }) {
  if (!entries || entries.length === 0) {
    return <td className="px-3 py-2.5 text-center text-muted-text text-sm">–</td>
  }
  const latest = entries[entries.length - 1]
  const colorClass = SCORE_COLOR[latest.score] ?? 'bg-border text-dark-text'
  return (
    <td className="px-3 py-2.5 text-center">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${colorClass}`}>
        {latest.score}
      </span>
    </td>
  )
}

function StudentTable({ students, skillNames }: { students: StudentRow[]; skillNames: string[] }) {
  if (students.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2.5 font-semibold text-dark-text whitespace-nowrap min-w-[160px]">Student</th>
            {skillNames.map(name => (
              <th key={name} className="px-3 py-2.5 font-semibold text-dark-text whitespace-nowrap text-center max-w-[120px]">
                <span className="block truncate" title={name}>{name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
              <td className="px-3 py-2.5 font-medium text-dark-text whitespace-nowrap">{student.name}</td>
              {skillNames.map(name => (
                <ScoreCell key={name} entries={student.skills[name]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function InstructorConfidenceView({ students, skillNames }: Props) {
  const [pastOpen, setPastOpen] = useState(false)

  const current = students.filter(s => !s.isPast)
  const past = students.filter(s => s.isPast)

  if (skillNames.length === 0 && current.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text text-sm">No confidence data yet. Students can track their skills from the Tools menu.</p>
      </div>
    )
  }

  if (skillNames.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center">
        <p className="text-muted-text text-sm">No skills tracked yet. Students can add skills from the Confidence Tracker in their Tools menu.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Score legend */}
      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-text">
        <span className="font-semibold text-dark-text">Score:</span>
        {[
          { range: '1–2', label: 'Just learned', color: 'bg-red-100 text-red-700' },
          { range: '3–4', label: 'With guidance', color: 'bg-orange-100 text-orange-700' },
          { range: '5–6', label: 'Basics', color: 'bg-yellow-100 text-yellow-700' },
          { range: '7–8', label: 'Independent', color: 'bg-green-100 text-green-700' },
          { range: '9–10', label: 'Expert', color: 'bg-teal-100 text-teal-700' },
        ].map(({ range, label, color }) => (
          <span key={range} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${color}`}>
            <strong>{range}</strong> {label}
          </span>
        ))}
      </div>

      {/* Current students table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-dark-text">{current.length} enrolled student{current.length !== 1 ? 's' : ''}</p>
        </div>
        {current.length > 0 ? (
          <StudentTable students={current} skillNames={skillNames} />
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-text">No enrolled students have tracked skills yet.</p>
        )}
      </div>

      {/* Past students accordion */}
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

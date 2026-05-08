'use client'
import { useState, useEffect } from 'react'
import type { ClassStudent } from '@/lib/airtable'

interface Props {
  initialClasses: string[]
}

function ZoneBadge({ absences }: { absences: number }) {
  if (absences >= 23)
    return (
      <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-red-200 text-red-900">
        Red
      </span>
    )
  if (absences >= 12)
    return (
      <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-yellow-200 text-yellow-900">
        Yellow
      </span>
    )
  return (
    <span className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
      Green
    </span>
  )
}

function CountBadge({
  value,
  redAbove,
  yellowAbove,
}: {
  value: number
  redAbove?: number
  yellowAbove?: number
}) {
  const isRed = redAbove !== undefined && value > redAbove
  const isYellow = !isRed && yellowAbove !== undefined && value > yellowAbove
  const cls = isRed
    ? 'bg-red-200 text-red-900'
    : isYellow
      ? 'bg-yellow-200 text-yellow-900'
      : 'bg-green-100 text-green-800'
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>
      {value}
    </span>
  )
}

function PercentBadge({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-sm text-muted-text">N/A</span>
  const rounded = Math.round(value)
  const cls =
    value > 7
      ? 'bg-red-200 text-red-900'
      : value > 4
        ? 'bg-yellow-200 text-yellow-900'
        : 'bg-green-100 text-green-800'
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>
      {rounded}%
    </span>
  )
}

export default function InstructorAttendanceView({ initialClasses }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [students, setStudents] = useState<ClassStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!selectedClass) return
    let cancelled = false

    setLoading(true)
    setError('')
    setStudents([])

    fetch(`/api/attendance/instructor/class?name=${encodeURIComponent(selectedClass)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
        } else {
          setStudents(data.students ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load class data. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [selectedClass])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-text">Instructor Attendance Report</h1>
        <p className="text-sm text-muted-text mt-1">View attendance summary for your classes</p>
      </div>

      {/* Class selector */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <label className="block text-sm font-medium text-dark-text mb-3" htmlFor="class-select">
          Select Class
        </label>
        {initialClasses.length === 0 ? (
          <p className="text-muted-text text-sm">No active classes found.</p>
        ) : (
          <select
            id="class-select"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-dark-text focus:ring-2 focus:ring-teal-primary focus:border-transparent"
          >
            <option value="">Choose a course</option>
            {initialClasses.map(cls => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Attendance table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-dark-text">Student Attendance Summary</h2>
          {selectedClass && (
            <p className="text-sm text-muted-text mt-1">{selectedClass}</p>
          )}
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-text">Loading attendance data…</div>
        ) : !selectedClass ? (
          <div className="p-10 text-center text-muted-text">Select a class above to view attendance.</div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center text-muted-text">No students found for this class.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-dark-text">Student</th>
                  <th className="px-6 py-3 text-left font-semibold text-dark-text">Absences</th>
                  <th className="px-6 py-3 text-left font-semibold text-dark-text">Tardies</th>
                  <th className="px-6 py-3 text-left font-semibold text-dark-text">% Missed</th>
                  <th className="px-6 py-3 text-left font-semibold text-dark-text">Zone</th>
                  <th className="px-6 py-3 text-left font-semibold text-dark-text">Total Blocks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s, i) => (
                  <tr key={i} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4">
                      <a
                        href={`/student/attendance?as=${encodeURIComponent(s.preferredName)}`}
                        className="text-teal-primary hover:underline font-medium"
                      >
                        {s.preferredName}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <CountBadge value={s.absences} redAbove={0} />
                    </td>
                    <td className="px-6 py-4">
                      <CountBadge value={s.tardies} yellowAbove={0} />
                    </td>
                    <td className="px-6 py-4">
                      <PercentBadge value={s.percentMissed} />
                    </td>
                    <td className="px-6 py-4">
                      <ZoneBadge absences={s.absences} />
                    </td>
                    <td className="px-6 py-4 text-muted-text">{s.totalBlocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useTransition } from 'react'
import DatePickerField from '@/components/ui/DatePickerField'
import { getStudentActivity } from '@/lib/flashcards/admin-queries'
import type { StudentActivityRow } from '@/lib/flashcards/admin-queries'

type Course = { id: string; name: string }

type Props = {
  courses: Course[]
}

function getDefaultDateRange() {
  const now = new Date()
  const day = now.getDay() // 0 = Sun, 1 = Mon ...
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(monday), to: fmt(sunday) }
}

export default function AdminPageClient({ courses }: Props) {
  const defaults = getDefaultDateRange()
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [rows, setRows] = useState<StudentActivityRow[]>([])
  const [isPending, startTransition] = useTransition()
  const [hasQueried, setHasQueried] = useState(false)

  useEffect(() => {
    if (!selectedCourseId || !fromDate || !toDate) return
    setHasQueried(true)
    startTransition(async () => {
      const data = await getStudentActivity(selectedCourseId, fromDate, toDate)
      setRows(data)
    })
  }, [selectedCourseId, fromDate, toDate])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-10">

      {/* Course selector */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <label htmlFor="course-select" className="block text-sm font-medium text-dark-text mb-3">
          Select Course
        </label>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-text">No active courses found.</p>
        ) : (
          <select
            id="course-select"
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-dark-text focus:ring-2 focus:ring-teal-primary focus:border-transparent"
          >
            <option value="">Choose a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Student activity table */}
      <section aria-labelledby="activity-heading">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <h2 id="activity-heading" className="text-base font-semibold text-dark-text">Student Activity</h2>
          <div className="flex items-center gap-2">
            <DatePickerField
              value={fromDate}
              onChange={setFromDate}
              placeholder="From"
              className="w-36"
            />
            <span className="text-sm text-muted-text">to</span>
            <DatePickerField
              value={toDate}
              onChange={setToDate}
              placeholder="To"
              className="w-36"
            />
          </div>
        </div>

        {!selectedCourseId ? (
          <p className="text-sm text-muted-text">Select a course to view student activity.</p>
        ) : isPending ? (
          <p className="text-sm text-muted-text">Loading…</p>
        ) : !hasQueried ? null : rows.length === 0 ? (
          <p className="text-sm text-muted-text">No students enrolled in this course.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-3 font-semibold text-dark-text">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-dark-text">Cards Studied</th>
                  <th className="text-left px-4 py-3 font-semibold text-dark-text">Days Active</th>
                  <th className="text-left px-4 py-3 font-semibold text-dark-text">Most Studied Deck(s)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.userId} className={i % 2 === 0 ? 'bg-background' : 'bg-surface'}>
                    <td className="px-4 py-3 text-dark-text font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-dark-text">{row.cardsStudied}</td>
                    <td className="px-4 py-3 text-dark-text">{row.daysActive}</td>
                    <td className="px-4 py-3 text-muted-text">
                      {row.mostStudiedDecks.length > 0 ? row.mostStudiedDecks.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

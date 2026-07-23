'use client'
import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import DatePickerField from '@/components/ui/DatePickerField'
import { getStudentActivity, getMostStudiedDecks } from '@/lib/flashcards/admin-queries'
import type { StudentActivityRow, MostStudiedDeck } from '@/lib/flashcards/admin-queries'

type Course = { id: string; name: string }

function getDefaultDateRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = (day === 0 ? -6 : 1 - day)
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(monday), to: fmt(sunday) }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function StudentActivityClient({ courses }: { courses: Course[] }) {
  const defaults = getDefaultDateRange()
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  const [activityOpen, setActivityOpen] = useState(false)
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [rows, setRows] = useState<StudentActivityRow[]>([])
  const [isPending, startTransition] = useTransition()
  const [hasQueried, setHasQueried] = useState(false)

  const [decksOpen, setDecksOpen] = useState(false)
  const [deckFromDate, setDeckFromDate] = useState(defaults.from)
  const [deckToDate, setDeckToDate] = useState(defaults.to)
  const [deckRows, setDeckRows] = useState<MostStudiedDeck[]>([])
  const [isDeckPending, startDeckTransition] = useTransition()
  const [deckHasQueried, setDeckHasQueried] = useState(false)
  const [showTop10, setShowTop10] = useState(false)

  useEffect(() => {
    if (!selectedCourseId || !fromDate || !toDate) return
    setHasQueried(true)
    startTransition(async () => {
      const data = await getStudentActivity(selectedCourseId, fromDate, toDate)
      setRows(data)
    })
  }, [selectedCourseId, fromDate, toDate])

  useEffect(() => {
    if (!selectedCourseId || !deckFromDate || !deckToDate) return
    setDeckHasQueried(true)
    startDeckTransition(async () => {
      const data = await getMostStudiedDecks(selectedCourseId, deckFromDate, deckToDate, showTop10 ? 10 : 5)
      setDeckRows(data)
    })
  }, [selectedCourseId, deckFromDate, deckToDate, showTop10])

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <Link href="/flashcards/admin" className="text-sm text-muted-text hover:text-dark-text transition-colors">
          ← Admin
        </Link>
        <h1 className="text-2xl font-bold text-dark-text mt-2">Student Activity</h1>
      </div>

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
            onChange={e => {
              setSelectedCourseId(e.target.value)
              if (e.target.value) { setActivityOpen(true); setDecksOpen(true) }
            }}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-dark-text focus:ring-2 focus:ring-teal-primary focus:border-transparent"
          >
            <option value="">Choose a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setActivityOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-dark-text hover:bg-background transition-colors"
            aria-expanded={activityOpen}
          >
            <span>Student Activity</span>
            <ChevronIcon open={activityOpen} />
          </button>

          {activityOpen && (
            <div className="border-t border-border px-5 pb-5 pt-4 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <DatePickerField value={fromDate} onChange={setFromDate} placeholder="From" className="w-36" />
                <span className="text-sm text-muted-text">to</span>
                <DatePickerField value={toDate} onChange={setToDate} placeholder="To" className="w-36" />
              </div>

              {!selectedCourseId ? (
                <p className="text-sm text-muted-text">Select a course to see data.</p>
              ) : isPending ? (
                <p className="text-sm text-muted-text">Loading…</p>
              ) : !hasQueried ? null : rows.length === 0 ? (
                <p className="text-sm text-muted-text">No students enrolled in this course.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th className="text-left px-4 py-3 font-semibold text-dark-text">Name</th>
                        <th className="text-left px-4 py-3 font-semibold text-dark-text">Cards Studied</th>
                        <th className="text-left px-4 py-3 font-semibold text-dark-text">Days Active</th>
                        <th className="text-left px-4 py-3 font-semibold text-dark-text">Most Studied Deck(s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.userId} className={i % 2 === 0 ? 'bg-surface' : 'bg-background'}>
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
            </div>
          )}
        </div>

        {/* Most-studied decks */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setDecksOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-dark-text hover:bg-background transition-colors"
            aria-expanded={decksOpen}
          >
            <span>Most Studied Decks</span>
            <ChevronIcon open={decksOpen} />
          </button>

          {decksOpen && (
            <div className="border-t border-border px-5 pb-5 pt-4 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <DatePickerField value={deckFromDate} onChange={setDeckFromDate} placeholder="From" className="w-36" />
                <span className="text-sm text-muted-text">to</span>
                <DatePickerField value={deckToDate} onChange={setDeckToDate} placeholder="To" className="w-36" />
              </div>

              {!selectedCourseId ? (
                <p className="text-sm text-muted-text">Select a course to see data.</p>
              ) : isDeckPending ? (
                <p className="text-sm text-muted-text">Loading…</p>
              ) : !deckHasQueried ? null : deckRows.length === 0 ? (
                <p className="text-sm text-muted-text">No decks studied in the selected date range.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deckRows.map((deck, i) => (
                      <div key={deck.deckId} className="bg-background border border-border rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-dark-text">{deck.title}</span>
                          <span className="text-xs font-bold text-muted-text shrink-0">#{i + 1}</span>
                        </div>
                        {deck.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {deck.tags.map(tag => (
                              <span key={tag} className="bg-teal-light text-teal-primary text-xs font-medium px-2 py-0.5 rounded-md">{tag}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-text mt-auto pt-1">{deck.totalReviews} {deck.totalReviews === 1 ? 'card reviewed' : 'cards reviewed'}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowTop10(v => !v)}
                    className="text-xs text-teal-primary hover:underline w-fit"
                  >
                    {showTop10 ? 'Show top 5' : 'Show top 10'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
    </div>
  )
}

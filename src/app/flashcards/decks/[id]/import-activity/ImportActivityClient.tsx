'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Importer } from '@/lib/flashcards/admin-queries'

type Course = { id: string; name: string }

type Props = {
  deckId: string
  deckTitle: string
  lastPushDate: string | null
  totalCount: number
  importers: Importer[]
  courses: Course[]
}

export default function ImportActivityClient({ deckId, deckTitle, lastPushDate, totalCount, importers, courses }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [namesOpen, setNamesOpen] = useState(false)

  const filteredImporters = selectedCourseId
    ? importers.filter(i => i.courseIds.includes(selectedCourseId))
    : importers

  const filteredCount = filteredImporters.length

  const formattedPushDate = lastPushDate
    ? new Date(lastPushDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href={`/flashcards/decks/${deckId}`} className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-6">
        ← Back to {deckTitle}
      </Link>

      <h1 className="text-2xl font-bold text-dark-text mb-1">Import Activity</h1>
      <p className="text-sm text-muted-text mb-8">{deckTitle}</p>

      {/* Course filter */}
      <div className="bg-surface rounded-xl border border-border p-6 mb-6">
        <label htmlFor="course-filter" className="block text-sm font-medium text-dark-text mb-3">
          Filter by Course
        </label>
        <select
          id="course-filter"
          value={selectedCourseId}
          onChange={e => setSelectedCourseId(e.target.value)}
          className="w-full px-4 py-3 border border-border rounded-lg bg-background text-dark-text focus:ring-2 focus:ring-teal-primary focus:border-transparent"
        >
          <option value="">All courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-4">
        <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-1">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-widest">
            {selectedCourseId ? 'Imports in this course' : 'Total imports'}
          </p>
          <p className="text-3xl font-bold text-dark-text">{filteredCount}</p>
        </div>

        {formattedPushDate && (
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-1">
            <p className="text-xs font-semibold text-muted-text uppercase tracking-widest">Last push date</p>
            <p className="text-lg font-semibold text-dark-text">{formattedPushDate}</p>
          </div>
        )}

        {/* Collapsible names list */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <button
            type="button"
            onClick={() => setNamesOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-dark-text hover:bg-background transition-colors"
            aria-expanded={namesOpen}
          >
            <span>
              {filteredCount === 0
                ? 'No importers'
                : `${filteredCount} ${filteredCount === 1 ? 'importer' : 'importers'}`}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className={`transition-transform ${namesOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {namesOpen && (
            <div className="border-t border-border">
              {filteredImporters.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-text">No importers for the selected course.</p>
              ) : (
                <ul>
                  {filteredImporters.map((importer, i) => (
                    <li
                      key={importer.userId}
                      className={`px-5 py-3 text-sm text-dark-text ${i % 2 === 0 ? 'bg-background' : 'bg-surface'}`}
                    >
                      {importer.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

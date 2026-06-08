'use client'

import { useState, useMemo } from 'react'
import type { RatingSubmission } from '@/lib/partner-ratings-actions'

interface Props {
  initialRatings: RatingSubmission[]
}

function StarDisplay({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${score} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`text-base leading-none ${n <= score ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function RatingSubmissionsView({ initialRatings }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return initialRatings
    return initialRatings.filter(r =>
      r.partners?.name?.toLowerCase().includes(q) ||
      r.service_category?.toLowerCase().includes(q) ||
      r.reviewer?.name?.toLowerCase().includes(q)
    )
  }, [initialRatings, search])

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Ratings', value: initialRatings.length },
          {
            label: 'Student Ratings',
            value: initialRatings.filter(r => r.reviewer_type === 'student').length,
          },
          {
            label: 'Staff Ratings',
            value: initialRatings.filter(r => r.reviewer_type === 'staff').length,
          },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-muted-text">{stat.label}</p>
            <p className="text-xl font-bold text-dark-text mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by partner, category, or reviewer…"
          className="flex-1 max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-xs text-muted-text hover:text-dark-text transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-text py-8 text-center">
          {initialRatings.length === 0
            ? 'No ratings submitted yet.'
            : 'No ratings match your search.'}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Reviewer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-wide">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => (
                  <tr key={r.id} className="bg-background hover:bg-surface transition-colors">
                    <td className="px-4 py-3 font-medium text-dark-text">
                      {r.partners?.name ?? <span className="text-muted-text italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-text">{r.service_category}</td>
                    <td className="px-4 py-3">
                      <StarDisplay score={r.score} />
                    </td>
                    <td className="px-4 py-3 text-muted-text">
                      {r.reviewer?.name ?? <span className="italic">Anonymous</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          r.reviewer_type === 'student'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}
                      >
                        {r.reviewer_type === 'student' ? 'Student' : 'Staff'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-text max-w-xs">
                      {r.notes ? (
                        <span className="line-clamp-2">{r.notes}</span>
                      ) : (
                        <span className="italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-text whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {filtered.map(r => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-surface px-4 py-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm text-dark-text">
                      {r.partners?.name ?? <span className="italic text-muted-text">Unknown org</span>}
                    </span>
                    <span className="text-xs text-muted-text">{r.service_category}</span>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
                      r.reviewer_type === 'student'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    }`}
                  >
                    {r.reviewer_type === 'student' ? 'Student' : 'Staff'}
                  </span>
                </div>
                <StarDisplay score={r.score} />
                {r.notes && <p className="text-xs text-muted-text italic">{r.notes}</p>}
                <div className="flex items-center justify-between text-xs text-muted-text">
                  <span>{r.reviewer?.name ?? 'Anonymous'}</span>
                  <span>{formatDate(r.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

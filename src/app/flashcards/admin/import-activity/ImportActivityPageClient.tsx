'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { DeckImportSummary } from '@/lib/flashcards/admin-queries'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function DeckRow({ deck, index }: { deck: DeckImportSummary; index: number }) {
  const [namesOpen, setNamesOpen] = useState(false)

  const formattedDate = deck.lastPushDate
    ? new Date(deck.lastPushDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const rowBg = index % 2 === 0 ? 'bg-surface' : 'bg-background'

  return (
    <>
      <tr className={rowBg}>
        <td className="px-4 py-3 text-sm text-dark-text font-medium align-top">{deck.title}</td>
        <td className="px-4 py-3 text-sm text-dark-text text-center align-top">{deck.importCount}</td>
        <td className="px-4 py-3 text-sm text-muted-text align-top">{formattedDate}</td>
        <td className="px-4 py-3 align-top">
          {deck.importCount > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setNamesOpen(o => !o)}
                className="inline-flex items-center gap-1.5 text-xs text-teal-primary hover:underline mb-2"
                aria-expanded={namesOpen}
              >
                {namesOpen ? 'Hide' : 'Show'} names
                <ChevronIcon open={namesOpen} />
              </button>
              {namesOpen && (
                <ul className="flex flex-col gap-1">
                  {deck.importers.map(imp => (
                    <li key={imp.userId} className="text-sm text-dark-text">
                      {imp.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-text">—</span>
          )}
        </td>
      </tr>
    </>
  )
}

export default function ImportActivityPageClient({ decks }: { decks: DeckImportSummary[] }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link href="/flashcards/admin" className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-6">
        ← Admin
      </Link>

      <h1 className="text-2xl font-bold text-dark-text mb-8">Import Activity</h1>

      {decks.length === 0 ? (
        <p className="text-sm text-muted-text">No shared decks yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-widest">Deck</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-text uppercase tracking-widest">Importers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-widest">Last Push</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-text uppercase tracking-widest">Students</th>
              </tr>
            </thead>
            <tbody>
              {decks.map((deck, i) => (
                <DeckRow key={deck.deckId} deck={deck} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

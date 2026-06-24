'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ImportDeckModal from './ImportDeckModal'

type Props = {
  deckCount: number
  cardsDueToday: number
}

export default function MyDecksHeader({ deckCount, cardsDueToday }: Props) {
  const [showImport, setShowImport] = useState(false)
  const searchParams = useSearchParams()
  const from = searchParams.get('from')

  return (
    <>
      <Link href={from ?? '/student/courses'} className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4">
        {from ? '← Back to Course' : '← Back to Home'}
      </Link>
      <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">My Decks</h1>
          <p className="text-sm text-muted-text mt-1">
            {deckCount} {deckCount === 1 ? 'deck' : 'decks'} · {cardsDueToday} {cardsDueToday === 1 ? 'card' : 'cards'} due today
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 border border-border text-muted-text text-sm font-medium px-4 py-2 rounded-lg hover:text-teal-primary hover:border-teal-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Import Deck
          </button>
          <Link
            href="/flashcards/decks/new"
            className="flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Deck
          </Link>
        </div>
      </div>

      {showImport && <ImportDeckModal onClose={() => setShowImport(false)} />}
    </>
  )
}

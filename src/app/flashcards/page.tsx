import { getAllDecksWithCounts } from '@/lib/flashcards/seed'
import DeckCard from '@/components/flashcards/DeckCard'
import ActivityGrid from '@/components/flashcards/ActivityGrid'
import Link from 'next/link'

export default function FlashcardsPage() {
  const decks = getAllDecksWithCounts()
  const totalCards = decks.reduce((sum, d) => sum + d.card_count, 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">My Decks</h1>
          <p className="text-sm text-muted-text mt-1">
            {decks.length} {decks.length === 1 ? 'deck' : 'decks'} · {totalCards} cards total
          </p>
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {decks.map(deck => (
          <DeckCard key={deck.id} deck={deck} />
        ))}

        <Link
          href="/flashcards/decks/new"
          className="border border-dashed border-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-[180px] text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors"
          aria-label="Create a new deck"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span className="text-sm">New deck</span>
        </Link>
      </div>

      <ActivityGrid />

    </div>
  )
}

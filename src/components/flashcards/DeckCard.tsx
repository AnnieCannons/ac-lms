import Link from 'next/link'
import type { DeckWithCounts } from '@/lib/flashcards/seed'
import ShareButton from './ShareButton'

export default function DeckCard({ deck }: { deck: DeckWithCounts }) {
  const hasDue = deck.new_count + deck.in_progress_count + deck.review_count > 0

  return (
    <div className="relative bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-teal-primary transition-colors">

      {hasDue && (
        <span
          className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-teal-primary"
          aria-label="Cards available to study"
        />
      )}

      <div className="pr-5">
        <h2 className="text-base font-semibold text-dark-text leading-snug">{deck.title}</h2>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {deck.tags.map(tag => (
          <span
            key={tag}
            className="bg-teal-light text-teal-primary text-xs font-medium px-2 py-0.5 rounded-md"
          >
            {tag}
          </span>
        ))}
        {deck.original_deck_id && (
          <span className="border border-purple-primary/40 text-purple-primary text-xs font-medium px-2 py-0.5 rounded-md">
            Shared with me
          </span>
        )}
      </div>

      <p className="text-xs text-muted-text">{deck.card_count} cards</p>

      <div className="flex gap-2 text-xs flex-wrap">
        {deck.new_count > 0 && (
          <span className="text-purple-primary font-medium">{deck.new_count} New</span>
        )}
        {deck.in_progress_count > 0 && (
          <>
            {deck.new_count > 0 && <span className="text-border">·</span>}
            <span className="text-amber-600 font-medium">{deck.in_progress_count} In Progress</span>
          </>
        )}
        {deck.review_count > 0 && (
          <>
            {(deck.new_count > 0 || deck.in_progress_count > 0) && <span className="text-border">·</span>}
            <span className="text-green-600 font-medium">{deck.review_count} Review</span>
          </>
        )}
        {!hasDue && (
          <span className="text-emerald-600 font-medium">All caught up ✓</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-1">
        <Link
          href={`/flashcards/study/${deck.id}`}
          className="text-xs font-medium text-teal-primary border border-border rounded-lg px-3 py-1.5 hover:bg-teal-light transition-colors"
        >
          Study →
        </Link>
        <div className="flex gap-1.5">
          <ShareButton deckId={deck.id} shareToken={deck.share_token} deckTitle={deck.title} />
          <div className="relative group">
            <Link
              href={`/flashcards/decks/${deck.id}`}
              className="w-7 h-7 flex items-center justify-center border border-border rounded-lg text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors"
              aria-label={`Edit deck: ${deck.title}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </Link>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
              Edit deck
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

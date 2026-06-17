'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import CardForm from '@/components/flashcards/CardForm'
import { SEED_DECKS, SEED_CARDS } from '@/lib/flashcards/seed'
import type { CardType } from '@/lib/flashcards/seed'

export default function EditCardPage() {
  const params = useParams()
  const deckId = params.id as string
  const cardId = params.cardId as string

  const deck = SEED_DECKS.find(d => d.id === deckId)
  const card = SEED_CARDS.find(c => c.id === cardId)

  const handleSave = ({ card_type, front_content, back_content }: { card_type: CardType; front_content: string; back_content: string }) => {
    // In production this will be a Supabase update
    console.log('Update card (seed phase):', { id: cardId, card_type, front_content, back_content })
  }

  if (!card) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href={`/flashcards/decks/${deckId}`} className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4">
          ← Back to Cards
        </Link>
        <p className="text-muted-text text-sm">Card not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href={`/flashcards/decks/${deckId}`}
          className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4"
        >
          ← Back to {deck?.title ?? 'Cards'}
        </Link>
        <h1 className="text-2xl font-bold text-dark-text">Edit Card</h1>
      </div>

      <CardForm
        mode="edit"
        deckId={deckId}
        initialType={card.card_type}
        initialFront={card.front_content}
        initialBack={card.back_content}
        onSave={handleSave}
      />
    </div>
  )
}

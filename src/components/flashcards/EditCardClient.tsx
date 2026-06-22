'use client'
import Link from 'next/link'
import CardForm from '@/components/flashcards/CardForm'
import { updateCard } from '@/lib/flashcards/actions'
import type { Card, CardType } from '@/lib/flashcards/seed'

type Props = {
  deckId: string
  deckTitle: string | null
  card: Card
}

export default function EditCardClient({ deckId, deckTitle, card }: Props) {
  const handleSave = async ({ card_type, front_content, back_content }: { card_type: CardType; front_content: string; back_content: string }) => {
    try {
      await updateCard(card.id, deckId, { card_type, front_content, back_content })
    } catch (err) {
      console.error('Failed to update card:', err)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href={`/flashcards/decks/${deckId}`}
          className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4"
        >
          ← Back to {deckTitle ?? 'Cards'}
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

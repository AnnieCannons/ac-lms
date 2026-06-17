'use client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import CardForm from '@/components/flashcards/CardForm'
import { SEED_DECKS } from '@/lib/flashcards/seed'
import type { CardType } from '@/lib/flashcards/seed'

export default function NewCardPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string
  const deck = SEED_DECKS.find(d => d.id === deckId)

  const handleSave = ({ card_type, front_content, back_content }: { card_type: CardType; front_content: string; back_content: string }) => {
    // In production this will be a Supabase insert
    console.log('Create card (seed phase):', { deck_id: deckId, card_type, front_content, back_content })
    router.push(`/flashcards/decks/${deckId}/cards`)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href={`/flashcards/decks/${deckId}/cards`}
          className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4"
        >
          ← Back to {deck?.title ?? 'Cards'}
        </Link>
        <h1 className="text-2xl font-bold text-dark-text">New Card</h1>
      </div>

      <CardForm mode="create" deckId={deckId} onSave={handleSave} />
    </div>
  )
}

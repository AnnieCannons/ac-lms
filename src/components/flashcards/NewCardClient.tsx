'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CardForm from '@/components/flashcards/CardForm'
import { createCard } from '@/lib/flashcards/actions'
import type { CardType } from '@/lib/flashcards/seed'

type Props = {
  deckId: string
  deckTitle: string | null
}

export default function NewCardClient({ deckId, deckTitle }: Props) {
  const router = useRouter()

  const handleSave = async ({ card_type, front_content, back_content }: { card_type: CardType; front_content: string; back_content: string }) => {
    try {
      await createCard(deckId, { card_type, front_content, back_content })
      router.push(`/flashcards/decks/${deckId}`)
    } catch (err) {
      console.error('Failed to create card:', err)
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
        <h1 className="text-2xl font-bold text-dark-text">New Card</h1>
      </div>

      <CardForm mode="create" deckId={deckId} onSave={handleSave} />
    </div>
  )
}

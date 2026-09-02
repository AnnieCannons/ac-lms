'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CardFields, { canSubmitCard } from '@/components/flashcards/CardFields'
import type { CardType } from '@/lib/flashcards/seed'

type Props = {
  mode: 'create' | 'edit'
  deckId: string
  initialType?: CardType
  initialFront?: string
  initialBack?: string
  onSave: (data: { card_type: CardType; front_content: string; back_content: string }) => void
}

export default function CardForm({
  mode,
  deckId,
  initialType = 'basic',
  initialFront = '',
  initialBack = '',
  onSave,
}: Props) {
  const router = useRouter()
  const [cardType, setCardType] = useState<CardType>(initialType)
  const [front, setFront] = useState(initialFront)
  const [back, setBack] = useState(initialBack)
  const [saved, setSaved] = useState(false)

  const markDirty = () => setSaved(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitCard(cardType, front)) return
    onSave({ card_type: cardType, front_content: front, back_content: back })
    if (mode === 'edit') setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <CardFields
        deckId={deckId}
        cardType={cardType}
        front={front}
        back={back}
        onCardTypeChange={(t) => { setCardType(t); markDirty() }}
        onFrontChange={(v) => { setFront(v); markDirty() }}
        onBackChange={(v) => { setBack(v); markDirty() }}
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmitCard(cardType, front)}
          className="bg-teal-primary text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mode === 'create' ? 'Add Card' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/flashcards/decks/${deckId}`)}
          className="text-sm text-muted-text hover:text-dark-text transition-colors"
        >
          Cancel
        </button>
        {saved && (
          <span className="text-sm text-teal-primary ml-1" role="status">Saved!</span>
        )}
      </div>
    </form>
  )
}

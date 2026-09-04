'use client'
import { useState, useTransition } from 'react'
import CardFields, { canSubmitCard } from '@/components/flashcards/CardFields'
import { createCard, updateCard, createClozeCards, updateClozeCards } from '@/lib/flashcards/actions'
import type { CardType } from '@/lib/flashcards/schema'
import type { Card } from '@/lib/flashcards/schema'

type Props = {
  deckId: string
  mode: 'create' | 'edit'
  card?: Card
  onSaved: () => void
  onAddAnother: () => void
  onCancel: () => void
}

export default function InlineCardEditor({ deckId, mode, card, onSaved, onAddAnother, onCancel }: Props) {
  const [cardType, setCardType] = useState<CardType>((card?.card_type as CardType) ?? 'basic')
  const [front, setFront] = useState(card?.front_content ?? '')
  const [back, setBack] = useState(card?.back_content ?? '')
  const [isPending, startTransition] = useTransition()

  const canSubmit = canSubmitCard(cardType, front)

  const handleCardTypeChange = (type: CardType) => {
    if (type === 'cloze' && cardType !== 'cloze') {
      const combined = [front, back].filter(s => s.trim()).join(' ')
      setFront(combined)
      setBack('')
    }
    setCardType(type)
  }

  const save = (then: () => void) => {
    if (!canSubmit) return
    startTransition(async () => {
      try {
        if (mode === 'create') {
          if (cardType === 'cloze') {
            await createClozeCards(deckId, front)
          } else {
            await createCard(deckId, { card_type: cardType, front_content: front, back_content: back })
          }
        } else if (card) {
          if (cardType === 'cloze') {
            await updateClozeCards(deckId, card.front_content, front)
          } else {
            await updateCard(card.id, deckId, { card_type: cardType, front_content: front, back_content: back })
          }
        }
        then()
      } catch (err) {
        console.error('Failed to save card:', err)
      }
    })
  }

  return (
    <div className="bg-surface border-2 border-teal-primary/40 rounded-xl p-5 flex flex-col gap-5">
      <CardFields
        deckId={deckId}
        cardType={cardType}
        front={front}
        back={back}
        onCardTypeChange={handleCardTypeChange}
        onFrontChange={setFront}
        onBackChange={setBack}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => save(onSaved)}
          disabled={!canSubmit || isPending}
          className="bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : 'Save Deck'}
        </button>
        {mode === 'create' && (
          <button
            type="button"
            onClick={() => save(onAddAnother)}
            disabled={!canSubmit || isPending}
            className="text-sm font-medium text-teal-primary border border-teal-primary/50 px-4 py-2 rounded-lg hover:bg-teal-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add Another Card
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-sm text-muted-text hover:text-dark-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

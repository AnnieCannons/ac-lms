'use client'
import { useState, useTransition } from 'react'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ClozeCardEditor from '@/components/flashcards/ClozeCardEditor'
import { createCard, updateCard, createClozeCards, updateClozeCards } from '@/lib/flashcards/actions'
import type { CardType } from '@/lib/flashcards/seed'
import type { Card } from '@/lib/flashcards/seed'

const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'type_in', label: 'Type In' },
  { value: 'cloze', label: 'Fill in the Blank' },
]

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

  const isCloze = cardType === 'cloze'
  const canSubmit = front.trim() && (!isCloze || front.includes('data-type="cloze-blank"'))

  const save = (then: () => void) => {
    if (!canSubmit) return
    startTransition(async () => {
      try {
        if (mode === 'create') {
          if (isCloze) {
            await createClozeCards(deckId, front)
          } else {
            await createCard(deckId, { card_type: cardType, front_content: front, back_content: back })
          }
        } else if (card) {
          if (isCloze) {
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
      {/* Card type selector */}
      {mode === 'create' && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-text uppercase tracking-widest">Card Type</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Select card type">
            {CARD_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCardType(value)}
                aria-pressed={cardType === value}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  cardType === value
                    ? 'bg-teal-primary text-white border-teal-primary'
                    : 'bg-surface text-muted-text border-border hover:border-teal-primary hover:text-teal-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Card content fields */}
      {isCloze ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">
            Sentence <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <p className="text-xs text-muted-text -mt-1">
            Type a sentence, highlight a word or phrase, then click <span className="font-medium text-teal-primary">[ Blank ]</span> in the toolbar.
          </p>
          <ClozeCardEditor content={front} onChange={setFront} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">
              Front <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor
                content={front}
                onChange={setFront}
                placeholder="Front of the card…"
                minHeight={100}
                storagePath={`flashcard-images/${deckId}/`}
                ariaLabel="Front of card"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">
              {cardType === 'type_in' ? 'Expected Answer' : 'Back'}
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor
                content={back}
                onChange={setBack}
                placeholder={cardType === 'type_in' ? 'The correct answer…' : 'Back of the card…'}
                minHeight={100}
                storagePath={`flashcard-images/${deckId}/`}
                ariaLabel={cardType === 'type_in' ? 'Expected answer' : 'Back of card'}
              />
            </div>
          </div>
        </>
      )}

      {/* Actions */}
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

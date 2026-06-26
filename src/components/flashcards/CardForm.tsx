'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RichTextEditor from '@/components/ui/RichTextEditor'
import type { CardType } from '@/lib/flashcards/seed'

const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'type_in', label: 'Type In' },
  { value: 'cloze', label: 'Cloze' },
  { value: 'image_occlusion', label: 'Image Occlusion' },
]

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

  const isComingSoon = cardType === 'cloze' || cardType === 'image_occlusion'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!front.trim() || isComingSoon) return
    onSave({ card_type: cardType, front_content: front, back_content: back })
    if (mode === 'edit') setSaved(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Card type selector */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-dark-text">Card Type</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Select card type">
          {CARD_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setCardType(value); setSaved(false) }}
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

      {isComingSoon ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-dark-text mb-1">
            {cardType === 'cloze' ? 'Cloze' : 'Image Occlusion'} — Coming Soon
          </p>
          <p className="text-xs text-muted-text">
            {cardType === 'cloze'
              ? 'Fill-in-the-blank cards will be available in a future update.'
              : 'Image occlusion cards will be available in a future update.'}
          </p>
        </div>
      ) : (
        <>
          {/* Front */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              Front <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor
                content={front}
                onChange={val => { setFront(val); setSaved(false) }}
                placeholder="Front of the card…"
                minHeight={120}
                storagePath={`flashcard-images/${deckId}/`}
              />
            </div>
          </div>

          {/* Back */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              {cardType === 'type_in' ? 'Expected Answer' : 'Back'}
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor
                content={back}
                onChange={val => { setBack(val); setSaved(false) }}
                placeholder={cardType === 'type_in' ? 'The correct answer…' : 'Back of the card…'}
                minHeight={120}
                storagePath={`flashcard-images/${deckId}/`}
              />
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!front.trim() || isComingSoon}
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

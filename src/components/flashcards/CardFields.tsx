'use client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ClozeCardEditor from '@/components/flashcards/ClozeCardEditor'
import type { CardType } from '@/lib/flashcards/schema'

export const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'type_in', label: 'Type In' },
  { value: 'cloze', label: 'Fill in the Blank' },
  // { value: 'image_occlusion', label: 'Image Occlusion' }, // hidden until implemented
]

const TYPE_DESCRIPTIONS: Record<CardType, string> = {
  basic: 'Create a regular flashcard with a front and back. Write the prompt on the front and the answer on the back.',
  type_in: 'Create a card where the answer is typed in. Enter the prompt or question on the front, then enter the correct answer below.',
  cloze: '',
  image_occlusion: '',
}

type Props = {
  deckId: string
  cardType: CardType
  front: string
  back: string
  onCardTypeChange: (type: CardType) => void
  onFrontChange: (val: string) => void
  onBackChange: (val: string) => void
  showTypeSelector?: boolean
}

export default function CardFields({
  deckId,
  cardType,
  front,
  back,
  onCardTypeChange,
  onFrontChange,
  onBackChange,
  showTypeSelector = true,
}: Props) {
  const isCloze = cardType === 'cloze'
  const isComingSoon = cardType === 'image_occlusion'
  const description = TYPE_DESCRIPTIONS[cardType]

  return (
    <>
      {showTypeSelector && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-dark-text">Card Type</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Select card type">
            {CARD_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => onCardTypeChange(value)}
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
          {description && (
            <p className="text-xs text-muted-text pt-2">{description}</p>
          )}
          {isCloze && (
            <p className="text-xs text-muted-text pt-2">
              Type a sentence, highlight a word or phrase, then click{' '}
              <span className="font-medium text-teal-primary">[ Blank ]</span>{' '}
              in the toolbar to turn it into a blank. Each blank becomes its own card.
            </p>
          )}
        </div>
      )}

      {isComingSoon ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-dark-text mb-1">Image Occlusion — Coming Soon</p>
          <p className="text-xs text-muted-text">Image occlusion cards will be available in a future update.</p>
        </div>
      ) : isCloze ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-dark-text">
            Sentence <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          {!showTypeSelector && (
            <p className="text-xs text-muted-text -mt-0.5">
              Highlight a word or phrase, then click{' '}
              <span className="font-medium text-teal-primary">[ Blank ]</span> in the toolbar.
            </p>
          )}
          <ClozeCardEditor content={front} onChange={onFrontChange} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              Front <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor
                content={front}
                onChange={onFrontChange}
                placeholder="Front of the card…"
                minHeight={120}
                storagePath={`flashcard-images/${deckId}/`}
                ariaLabel="Front of card"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-dark-text">
              {cardType === 'type_in' ? 'Expected Answer' : 'Back'}
            </label>
            <div className="[&>div]:!bg-surface [&_.ProseMirror]:!bg-surface">
              <RichTextEditor
                content={back}
                onChange={onBackChange}
                placeholder={cardType === 'type_in' ? 'The correct answer…' : 'Back of the card…'}
                minHeight={120}
                storagePath={`flashcard-images/${deckId}/`}
                ariaLabel={cardType === 'type_in' ? 'Expected answer' : 'Back of card'}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function canSubmitCard(cardType: CardType, front: string): boolean {
  if (!front.trim()) return false
  if (cardType === 'image_occlusion') return false
  if (cardType === 'cloze') return front.includes('data-type="cloze-blank"')
  return true
}

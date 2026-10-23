'use client'
import { useMemo, useState, useTransition } from 'react'
import CardFields, { canSubmitCard } from '@/components/flashcards/CardFields'
import { updateCards, updateClozeCards } from '@/lib/flashcards/actions'
import { bulkEditChanges, bulkEditItems, type BulkDraft } from '@/lib/flashcards/bulk-edit'
import type { Card } from '@/lib/flashcards/schema'

const TYPE_LABELS: Record<string, string> = {
  basic: 'Basic',
  type_in: 'Type In',
  cloze: 'Fill in the Blank',
}

type Props = {
  deckId: string
  cards: Card[]
  onSaved: () => void
  onCancel: () => void
}

// Every card open for editing at once, saved together with one button.
export default function BulkCardEditor({ deckId, cards, onSaved, onCancel }: Props) {
  const items = useMemo(() => bulkEditItems(cards), [cards])
  const [drafts, setDrafts] = useState<Record<string, BulkDraft>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const changes = bulkEditChanges(items, drafts)
  const changedCount = changes.cards.length + changes.cloze.length
  const invalid = items.filter(item => {
    const d = drafts[item.key]
    return d && !canSubmitCard(item.cardType, d.front)
  })

  const draftFor = (key: string, front: string, back: string) => drafts[key] ?? { front, back }
  const setDraft = (key: string, front: string, back: string, patch: Partial<BulkDraft>) =>
    setDrafts(prev => ({ ...prev, [key]: { ...(prev[key] ?? { front, back }), ...patch } }))

  const cancel = () => {
    if (changedCount > 0 && !window.confirm(`Discard changes to ${changedCount} ${changedCount === 1 ? 'card' : 'cards'}?`)) return
    onCancel()
  }

  const save = () => {
    if (changedCount === 0) { onCancel(); return }
    if (invalid.length > 0) return
    setError(null)
    startTransition(async () => {
      try {
        if (changes.cards.length > 0) await updateCards(deckId, changes.cards)
        // Cloze groups are rebuilt one sentence at a time, as in the single-card editor.
        for (const c of changes.cloze) await updateClozeCards(deckId, c.originalFront, c.newFront)
        onSaved()
      } catch (err) {
        console.error('Failed to save cards:', err)
        setError('Some changes could not be saved. Please try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const d = draftFor(item.key, item.front, item.back)
        const changed = d.front !== item.front || d.back !== item.back
        const isInvalid = invalid.some(x => x.key === item.key)
        return (
          <div
            key={item.key}
            className={`bg-surface rounded-xl p-4 flex flex-col gap-4 border-2 ${changed ? 'border-teal-primary/50' : 'border-border'}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-text tabular-nums">{i + 1}</span>
              <span className="text-xs font-medium bg-teal-light text-teal-primary px-2 py-0.5 rounded-md">
                {TYPE_LABELS[item.cardType] ?? item.cardType}
              </span>
              {changed && <span className="text-xs font-medium text-teal-primary">Edited</span>}
              {isInvalid && (
                <span className="text-xs font-medium text-red-600" role="alert">
                  {item.cardType === 'cloze' ? 'Needs at least one blank' : 'Front can’t be empty'}
                </span>
              )}
            </div>
            <CardFields
              deckId={deckId}
              cardType={item.cardType}
              front={d.front}
              back={d.back}
              onCardTypeChange={() => {}}
              onFrontChange={front => setDraft(item.key, item.front, item.back, { front })}
              onBackChange={back => setDraft(item.key, item.front, item.back, { back })}
              showTypeSelector={false}
            />
          </div>
        )
      })}

      <div className="sticky bottom-0 z-10 -mx-1 px-1 pb-3 pt-2 bg-gradient-to-t from-background via-background to-transparent">
        <div className="bg-surface border border-border rounded-xl shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-text flex-1 min-w-[10rem]" role="status">
            {error ?? (changedCount === 0 ? 'No changes yet' : `${changedCount} ${changedCount === 1 ? 'card' : 'cards'} changed`)}
          </p>
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="text-sm text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending || invalid.length > 0}
            className="bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving…' : changedCount === 0 ? 'Done' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

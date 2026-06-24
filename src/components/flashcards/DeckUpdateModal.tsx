'use client'
import { useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import type { PendingDiff, DiffEntry } from '@/app/flashcards/decks/[id]/page'

function sanitize(html: string) {
  return DOMPurify.sanitize(html)
}

function CardPreview({ label, card }: { label: string; card: { front_content: string; back_content: string } }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold text-muted-text uppercase tracking-widest">{label}</span>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-muted-text mb-0.5">Front</p>
          <div
            className="prose prose-xs max-w-none text-dark-text [&_*]:text-dark-text"
            dangerouslySetInnerHTML={{ __html: sanitize(card.front_content) }}
          />
        </div>
        <div>
          <p className="text-[10px] text-muted-text mb-0.5">Back</p>
          <div
            className="prose prose-xs max-w-none text-dark-text [&_*]:text-dark-text"
            dangerouslySetInnerHTML={{ __html: sanitize(card.back_content) }}
          />
        </div>
      </div>
    </div>
  )
}

export type DiffSelection = {
  [sourceCardId: string]: 'apply' | 'mine' | 'skip' | boolean // boolean for new cards (add or skip)
}

type Props = {
  diff: PendingDiff
  onClose: () => void
  onApply: (selections: DiffSelection) => void
  applying: boolean
}

export default function DeckUpdateModal({ diff, onClose, onApply, applying }: Props) {
  const newCards = diff.entries.filter(e => e.kind === 'new') as Extract<DiffEntry, { kind: 'new' }>[]
  const modifiedCards = diff.entries.filter(e => e.kind === 'modified') as Extract<DiffEntry, { kind: 'modified' }>[]
  const conflictCards = diff.entries.filter(e => e.kind === 'conflict') as Extract<DiffEntry, { kind: 'conflict' }>[]

  const [selections, setSelections] = useState<DiffSelection>({})

  const setSelection = (id: string, val: DiffSelection[string]) => {
    setSelections((prev: DiffSelection) => ({ ...prev, [id]: val }))
  }

  const unresolvedConflicts = conflictCards.filter(e => !selections[e.snapshot.source_card_id])

  if (diff.entries.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
        <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-dark-text">No changes to apply</h2>
          <p className="text-sm text-muted-text">Your copy is already up to date with the latest shared version.</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="text-sm text-teal-primary hover:underline">Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-dark-text">Deck updates available</h2>
          <p className="text-sm text-muted-text mt-0.5">Choose which changes to apply to your copy.</p>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-6">

          {/* New cards */}
          {newCards.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-text uppercase tracking-widest mb-3">
                New cards ({newCards.length})
              </h3>
              <div className="flex flex-col gap-3">
                {newCards.map(entry => (
                  <label key={entry.snapshot.source_card_id} className="flex gap-3 items-start cursor-pointer bg-background rounded-xl p-4 border border-border hover:border-teal-primary transition-colors">
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0 accent-teal-primary"
                      checked={!!selections[entry.snapshot.source_card_id]}
                      onChange={e => setSelection(entry.snapshot.source_card_id, e.target.checked)}
                    />
                    <CardPreview label="Add this card" card={entry.snapshot} />
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Modified cards */}
          {modifiedCards.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-text uppercase tracking-widest mb-3">
                Updated cards ({modifiedCards.length})
              </h3>
              <div className="flex flex-col gap-3">
                {modifiedCards.map(entry => (
                  <label key={entry.snapshot.source_card_id} className="flex gap-3 items-start cursor-pointer bg-background rounded-xl p-4 border border-border hover:border-teal-primary transition-colors">
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0 accent-teal-primary"
                      checked={!!selections[entry.snapshot.source_card_id]}
                      onChange={e => setSelection(entry.snapshot.source_card_id, e.target.checked)}
                    />
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <CardPreview label="Updated version" card={entry.snapshot} />
                      <CardPreview label="Your current version" card={entry.importerCard} />
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Conflicts */}
          {conflictCards.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-text uppercase tracking-widest mb-1">
                Conflicts ({conflictCards.length})
              </h3>
              <p className="text-xs text-muted-text mb-3">You and the deck creator both edited these cards. Choose which version to keep.</p>
              <div className="flex flex-col gap-4">
                {conflictCards.map(entry => {
                  const id = entry.snapshot.source_card_id
                  const sel = selections[id] as 'apply' | 'mine' | 'skip' | undefined
                  return (
                    <div key={id} className="bg-background rounded-xl p-4 border border-amber-300/60 flex flex-col gap-4">
                      <CardPreview label="Creator's version" card={entry.snapshot} />
                      <CardPreview label="Your version" card={entry.importerCard} />
                      <div className="flex gap-2 flex-wrap">
                        {(['apply', 'mine', 'skip'] as const).map(opt => (
                          <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`conflict-${id}`}
                              className="accent-teal-primary"
                              checked={sel === opt}
                              onChange={() => setSelection(id, opt)}
                            />
                            <span className="text-sm text-dark-text">
                              {opt === 'apply' ? "Use creator's version" : opt === 'mine' ? 'Keep mine' : 'Skip'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-sm text-muted-text hover:text-dark-text transition-colors" disabled={applying}>
            Cancel
          </button>
          <button
            onClick={() => onApply(selections)}
            disabled={applying || unresolvedConflicts.length > 0}
            className="text-sm font-medium bg-teal-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {applying ? 'Applying…' : unresolvedConflicts.length > 0 ? `Resolve ${unresolvedConflicts.length} conflict${unresolvedConflicts.length > 1 ? 's' : ''} to continue` : 'Apply selected changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

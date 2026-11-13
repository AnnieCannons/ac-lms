// Pure rules for editing every card in a deck at once, then saving only what changed.
import type { Card, CardType } from './schema'

/**
 * One editable item. Cloze cards that share a sentence are a single item (one card per blank),
 * edited through the sentence, matching how the single-card editor treats them.
 */
export type BulkEditItem = {
  key: string
  cardType: CardType
  /** The card to update, or the first card of a cloze group. */
  card: Card
  front: string
  back: string
}

export function bulkEditItems(cards: Card[]): BulkEditItem[] {
  const seenSentences = new Set<string>()
  const items: BulkEditItem[] = []
  for (const card of cards) {
    if (card.card_type === 'cloze') {
      if (seenSentences.has(card.front_content)) continue
      seenSentences.add(card.front_content)
    }
    items.push({ key: card.id, cardType: card.card_type, card, front: card.front_content, back: card.back_content ?? '' })
  }
  return items
}

export type BulkDraft = { front: string; back: string }

export type BulkChanges = {
  cards: { id: string; card_type: CardType; front_content: string; back_content: string }[]
  cloze: { originalFront: string; newFront: string }[]
}

/** Only the items whose text differs from what was loaded. */
export function bulkEditChanges(items: BulkEditItem[], drafts: Record<string, BulkDraft>): BulkChanges {
  const changes: BulkChanges = { cards: [], cloze: [] }
  for (const item of items) {
    const draft = drafts[item.key]
    if (!draft || (draft.front === item.front && draft.back === item.back)) continue
    if (item.cardType === 'cloze') {
      changes.cloze.push({ originalFront: item.front, newFront: draft.front })
    } else {
      changes.cards.push({ id: item.card.id, card_type: item.cardType, front_content: draft.front, back_content: draft.back })
    }
  }
  return changes
}

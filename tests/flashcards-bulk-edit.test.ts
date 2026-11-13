import { describe, it, expect } from 'vitest'
import { bulkEditChanges, bulkEditItems } from '@/lib/flashcards/bulk-edit'
import type { Card } from '@/lib/flashcards/schema'

const card = (id: string, over: Partial<Card> = {}): Card => ({
  id, deck_id: 'd1', card_type: 'basic', front_content: `front ${id}`, back_content: `back ${id}`,
  audio_url: null, image_url: null, occlusion_zones: null, order: 0, created_at: '', updated_at: '', source_card_id: null, ...over,
})

describe('bulkEditItems', () => {
  it('lists each card, with one item per cloze sentence', () => {
    const cloze = '<p>The <span data-type="cloze-blank">sky</span> is <span data-type="cloze-blank">blue</span></p>'
    const items = bulkEditItems([
      card('a'),
      card('c1', { card_type: 'cloze', front_content: cloze, back_content: '' }),
      card('c2', { card_type: 'cloze', front_content: cloze, back_content: '' }),
      card('b', { card_type: 'type_in' }),
    ])
    expect(items.map(i => i.key)).toEqual(['a', 'c1', 'b'])
  })
})

describe('bulkEditChanges', () => {
  const items = bulkEditItems([
    card('a'),
    card('b'),
    card('c1', { card_type: 'cloze', front_content: '<p>x</p>', back_content: '' }),
  ])

  it('returns nothing when no drafts differ', () => {
    expect(bulkEditChanges(items, {})).toEqual({ cards: [], cloze: [] })
    expect(bulkEditChanges(items, { a: { front: 'front a', back: 'back a' } })).toEqual({ cards: [], cloze: [] })
  })

  it('returns only the edited cards, split by cloze vs regular', () => {
    const changes = bulkEditChanges(items, {
      a: { front: '<p><code>front a</code></p>', back: 'back a' },
      c1: { front: '<p>y</p>', back: '' },
    })
    expect(changes.cards).toEqual([{ id: 'a', card_type: 'basic', front_content: '<p><code>front a</code></p>', back_content: 'back a' }])
    expect(changes.cloze).toEqual([{ originalFront: '<p>x</p>', newFront: '<p>y</p>' }])
  })
})

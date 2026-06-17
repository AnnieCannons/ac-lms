'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { SEED_DECKS, SEED_CARDS } from '@/lib/flashcards/seed'
import CardItem from '@/components/flashcards/CardItem'
import type { Card } from '@/lib/flashcards/seed'

export default function CardsPage() {
  const params = useParams()
  const deckId = params.id as string

  const deck = SEED_DECKS.find(d => d.id === deckId)
  const initialCards = SEED_CARDS.filter(c => c.deck_id === deckId)
  const [cards, setCards] = useState<Card[]>(initialCards)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setCards(prev => {
        const oldIndex = prev.findIndex(c => c.id === active.id)
        const newIndex = prev.findIndex(c => c.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleDelete = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId))
  }

  if (!deck) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/flashcards" className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4">
          ← Back to My Decks
        </Link>
        <p className="text-muted-text text-sm">Deck not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/flashcards"
          className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4"
        >
          ← Back to My Decks
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">{deck.title}</h1>
            <p className="text-sm text-muted-text mt-1">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</p>
          </div>
          <Link
            href={`/flashcards/decks/${deckId}/cards/new`}
            className="flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Card
          </Link>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-text text-sm mb-4">No cards yet.</p>
          <Link
            href={`/flashcards/decks/${deckId}/cards/new`}
            className="inline-flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Add your first card
          </Link>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {cards.map(card => (
                <CardItem
                  key={card.id}
                  card={card}
                  deckId={deckId}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

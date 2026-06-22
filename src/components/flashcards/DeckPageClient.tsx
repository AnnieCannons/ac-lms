'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import CardItem from '@/components/flashcards/CardItem'
import DeleteDeckModal from '@/components/flashcards/DeleteDeckModal'
import { updateDeck, deleteDeck, deleteCard, reorderCards } from '@/lib/flashcards/actions'
import type { Deck, Card } from '@/lib/flashcards/seed'

const PREDEFINED_TAGS = [
  'HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'Node.js',
  'Express.js', 'APIs', 'Git', 'Command Line', 'Accessibility',
  'Career Development', 'Other',
]

type Props = {
  deckId: string
  deck: Deck
  initialCards: Card[]
}

export default function DeckPageClient({ deckId, deck, initialCards }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(deck.title)
  const [description, setDescription] = useState(deck.description ?? '')
  const [tags, setTags] = useState<string[]>(deck.tags)
  const [saved, setSaved] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = cards.findIndex(c => c.id === active.id)
    const newIndex = cards.findIndex(c => c.id === over.id)
    const reordered = arrayMove(cards, oldIndex, newIndex)
    setCards(reordered)

    try {
      await reorderCards(deckId, reordered.map(c => c.id))
    } catch (err) {
      console.error('Failed to reorder cards:', err)
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId))
    try {
      await deleteCard(cardId, deckId)
    } catch (err) {
      console.error('Failed to delete card:', err)
    }
  }

  const handleSaveDeck = async () => {
    if (!title.trim()) return
    try {
      await updateDeck(deckId, { title, description, tags })
      setSaved(true)
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to update deck:', err)
    }
  }

  const handleDeleteDeck = async () => {
    try {
      await deleteDeck(deckId)
      router.push('/flashcards')
    } catch (err) {
      console.error('Failed to delete deck:', err)
    }
  }

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">

      <Link
        href="/flashcards"
        className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-6"
      >
        ← Back to My Decks
      </Link>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        {isEditing ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); setSaved(false) }}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">Description <span className="text-muted-text font-normal normal-case tracking-normal">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => { setDescription(e.target.value); setSaved(false) }}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-text uppercase tracking-widest">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      tags.includes(tag)
                        ? 'bg-teal-primary text-white border-teal-primary'
                        : 'bg-surface text-muted-text border-border hover:border-teal-primary hover:text-teal-primary'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveDeck}
                disabled={!title.trim()}
                className="bg-teal-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setTitle(deck.title); setDescription(deck.description ?? ''); setTags(deck.tags); setSaved(false) }}
                className="text-sm text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-bold text-dark-text">{title}</h1>
              {description && <p className="text-sm text-muted-text">{description}</p>}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span key={tag} className="bg-teal-light text-teal-primary text-xs font-medium px-2 py-0.5 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {saved && <span className="text-xs text-teal-primary" role="status">Saved!</span>}
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="shrink-0 text-xs text-muted-text border border-border px-3 py-1.5 rounded-lg hover:text-teal-primary hover:border-teal-primary transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-text">{cards.length} {cards.length === 1 ? 'card' : 'cards'}</p>
        <Link
          href={`/flashcards/decks/${deckId}/cards/new`}
          className="flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Card
        </Link>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {cards.map(card => (
                <CardItem
                  key={card.id}
                  card={card}
                  deckId={deckId}
                  onDelete={handleDeleteCard}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="mt-10 rounded-lg border border-border bg-surface px-3 py-4 flex flex-col gap-3">
        <span className="text-sm font-medium text-red-600">Danger Zone</span>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-text">
            Deleting a deck permanently removes all its cards and progress. This cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="shrink-0 text-sm font-medium text-red-500 border border-red-400/50 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          >
            Delete this deck
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteDeckModal
          deckTitle={deck.title}
          onConfirm={handleDeleteDeck}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

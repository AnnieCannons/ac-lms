'use client'
import { useState, useEffect } from 'react'
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
import { updateDeck, deleteDeck, deleteCard, reorderCards, pushDeckUpdates, applyDeckUpdates } from '@/lib/flashcards/actions'
import DeckUpdateModal from '@/components/flashcards/DeckUpdateModal'
import type { Deck, Card } from '@/lib/flashcards/seed'
import type { PendingDiff } from '@/app/flashcards/decks/[id]/page'
import type { DiffSelection } from '@/components/flashcards/DeckUpdateModal'

const PREDEFINED_TAGS = [
  'HTML', 'CSS', 'JavaScript', 'React', 'SQL', 'Node.js',
  'Express.js', 'APIs', 'Git', 'Command Line', 'Accessibility',
  'Career Development', 'Other',
]

const CURRICULUM_TAGS = ['TCF/ITP', 'Frontend', 'Backend']

type Props = {
  deckId: string
  deck: Deck
  initialCards: Card[]
  userId: string
  pendingDiff: PendingDiff | null
  isAdmin?: boolean
  hasUnpushedChanges?: boolean
}

export default function DeckPageClient({ deckId, deck, initialCards, userId, pendingDiff, isAdmin, hasUnpushedChanges }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>(initialCards)
  useEffect(() => { setCards(initialCards) }, [initialCards])
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(deck.title)
  const [description, setDescription] = useState(deck.description ?? '')
  const [tags, setTags] = useState<string[]>(deck.tags)
  const [courseTag, setCourseTag] = useState<string[]>(deck.course_tag ?? [])
  const [saved, setSaved] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareConfirm, setShowShareConfirm] = useState(false)
  const [shareUpdatesSending, setShareUpdatesSending] = useState(false)
  const [shareUpdatesDone, setShareUpdatesDone] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(!!pendingDiff)
  useEffect(() => { if (pendingDiff) setShowDiffModal(true) }, [pendingDiff])
  const [applyingDiff, setApplyingDiff] = useState(false)

  const isOwner = deck.owner_user_id === userId
  const canShareUpdates = isOwner && deck.is_shared

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
      await updateDeck(deckId, { title, description, tags, course_tag: courseTag })
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

      {canShareUpdates && hasUnpushedChanges && !shareUpdatesDone && (
        <div className="mb-6 rounded-lg border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Let people who imported this deck know about your updates?
          </p>
          <button
            onClick={() => setShowShareConfirm(true)}
            className="shrink-0 text-sm font-medium text-teal-primary border border-teal-primary/40 px-4 py-2 rounded-lg hover:bg-teal-light transition-colors"
          >
            Share updates
          </button>
        </div>
      )}
      {canShareUpdates && shareUpdatesDone && (
        <div className="mb-6 rounded-lg border border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Updates shared ✓
          </p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        {isEditing ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSaved(false);
                }}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-text uppercase tracking-widest">
                Description{" "}
                <span className="text-muted-text font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setSaved(false);
                }}
                rows={2}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-text uppercase tracking-widest">
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      tags.includes(tag)
                        ? "bg-teal-primary text-white border-teal-primary"
                        : "bg-surface text-muted-text border-border hover:border-teal-primary hover:text-teal-primary"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-text uppercase tracking-widest">
                  Course
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CURRICULUM_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setCourseTag((prev) =>
                          prev.includes(tag)
                            ? prev.filter((t) => t !== tag)
                            : [...prev, tag],
                        )
                      }
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        courseTag.includes(tag)
                          ? "bg-purple-primary text-white border-purple-primary"
                          : "bg-surface text-muted-text border-border hover:border-purple-primary hover:text-purple-primary"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveDeck}
                disabled={!title.trim()}
                className="bg-teal-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setTitle(deck.title);
                  setDescription(deck.description ?? "");
                  setTags(deck.tags);
                  setCourseTag(deck.course_tag ?? []);
                  setSaved(false);
                }}
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
              {description && (
                <p className="text-sm text-muted-text">{description}</p>
              )}
              {(tags.length > 0 || courseTag.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-teal-light text-teal-primary text-xs font-medium px-2 py-0.5 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                  {courseTag.map((tag) => (
                    <span
                      key={tag}
                      className="bg-purple-primary/10 text-purple-primary text-xs font-medium px-2 py-0.5 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {saved && (
                <span className="text-xs text-teal-primary" role="status">
                  Saved!
                </span>
              )}
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
        <p className="text-sm text-muted-text">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="relative group">
              <Link
                href={`/flashcards/decks/${deckId}/bulk-import`}
                className="flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Bulk Import
              </Link>
              <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-dark-text text-background text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                Paste notes and generate a deck of flashcards instantly
              </div>
            </div>
          )}
          <Link
            href={`/flashcards/decks/${deckId}/cards/new`}
            className="flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Card
          </Link>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <p className="text-muted-text text-sm">No cards yet.</p>
          {isAdmin && (
            <Link
              href={`/flashcards/decks/${deckId}/bulk-import`}
              className="inline-flex items-center gap-1.5 bg-teal-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Bulk Import
            </Link>
          )}
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
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {cards.map((card) => (
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

      {canShareUpdates && hasUnpushedChanges && !shareUpdatesDone && (
        <div className="mt-6 rounded-lg border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Do you want to share your updates?
          </p>
          <button
            onClick={() => setShowShareConfirm(true)}
            className="shrink-0 text-sm font-medium text-teal-primary border border-teal-primary/40 px-4 py-2 rounded-lg hover:bg-teal-light transition-colors"
          >
            Share updates
          </button>
        </div>
      )}
      {canShareUpdates && shareUpdatesDone && (
        <div className="mt-6 rounded-lg border border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Updates shared ✓
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-1.5">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="self-start text-sm font-medium text-red-500 border border-red-400/50 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
        >
          Delete this deck
        </button>
        <p className="text-xs text-muted-text">
          Permanently removes all cards and progress. This cannot be undone.
        </p>
      </div>

      {showDeleteModal && (
        <DeleteDeckModal
          deckTitle={deck.title}
          onConfirm={handleDeleteDeck}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showDiffModal && pendingDiff && (
        <DeckUpdateModal
          diff={pendingDiff}
          onClose={() => setShowDiffModal(false)}
          onApply={async (selections: DiffSelection) => {
            setApplyingDiff(true);
            try {
              await applyDeckUpdates(
                pendingDiff.notificationId,
                deckId,
                selections,
              );
              router.replace(`/flashcards/decks/${deckId}`);
              router.refresh();
            } catch (err) {
              console.error("Failed to apply deck updates:", err);
            } finally {
              setApplyingDiff(false);
              setShowDiffModal(false);
            }
          }}
          applying={applyingDiff}
        />
      )}

      {showShareConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-4">
            <h2 className="text-base font-semibold text-dark-text">
              Share your changes?
            </h2>
            <p className="text-sm text-muted-text">
              Everyone who has imported{" "}
              <strong className="text-dark-text">"{deck.title}"</strong> will
              get a notification and can choose which updates to apply to their
              copy.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowShareConfirm(false)}
                className="text-sm text-muted-text hover:text-dark-text px-4 py-2 rounded-lg transition-colors"
                disabled={shareUpdatesSending}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShareUpdatesSending(true);
                  try {
                    await pushDeckUpdates(deckId);
                    setShareUpdatesDone(true);
                  } catch (err) {
                    console.error("Failed to share updates:", err);
                  } finally {
                    setShareUpdatesSending(false);
                    setShowShareConfirm(false);
                  }
                }}
                disabled={shareUpdatesSending}
                className="text-sm font-medium bg-teal-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {shareUpdatesSending ? "Sharing…" : "Share updates"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

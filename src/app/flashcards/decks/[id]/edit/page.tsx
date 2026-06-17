'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import DeckForm from '@/components/flashcards/DeckForm'
import DeleteDeckModal from '@/components/flashcards/DeleteDeckModal'
import { SEED_DECKS } from '@/lib/flashcards/seed'

export default function EditDeckPage() {
  const router = useRouter()
  const params = useParams()
  const deckId = params.id as string

  const deck = SEED_DECKS.find(d => d.id === deckId)

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleSave = ({ title, description, tags }: { title: string; description: string; tags: string[] }) => {
    // In production this will be a Supabase update
    console.log('Update deck (seed phase):', { id: deckId, title, description, tags })
  }

  const handleDelete = () => {
    // In production this will be a Supabase delete
    console.log('Delete deck (seed phase):', deckId)
    router.push('/flashcards')
  }

  if (!deck) {
    return (
      <div className="max-w-xl mx-auto px-6 py-8">
        <Link href="/flashcards" className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4">
          ← Back to My Decks
        </Link>
        <p className="text-muted-text text-sm">Deck not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="mb-8">
        <Link
          href="/flashcards"
          className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-4"
        >
          ← Back to My Decks
        </Link>
        <h1 className="text-2xl font-bold text-dark-text">Edit Deck</h1>
      </div>

      <DeckForm
        mode="edit"
        deckId={deckId}
        initialTitle={deck.title}
        initialDescription={deck.description}
        initialTags={deck.tags}
        onSave={handleSave}
      />

      {/* Danger Zone */}
      <div className="mt-8 rounded-lg border border-border bg-surface px-3 py-4 flex flex-col gap-3">
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
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

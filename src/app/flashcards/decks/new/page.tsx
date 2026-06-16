'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DeckForm from '@/components/flashcards/DeckForm'

export default function NewDeckPage() {
  const router = useRouter()

  const handleSave = ({ title, description, tags }: { title: string; description: string; tags: string[] }) => {
    // In production this will be a Supabase insert — for now generate a placeholder ID
    const newId = crypto.randomUUID()
    console.log('Create deck (seed phase):', { title, description, tags, id: newId })
    router.push(`/flashcards/decks/${newId}/cards`)
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
        <h1 className="text-2xl font-bold text-dark-text">New Deck</h1>
      </div>

      <DeckForm mode="create" onSave={handleSave} />
    </div>
  )
}

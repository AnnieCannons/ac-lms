'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DeckForm from '@/components/flashcards/DeckForm'
import { createDeck } from '@/lib/flashcards/actions'

export default function NewDeckClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()

  const handleSave = async ({ title, description, tags, course_tag }: { title: string; description: string; tags: string[]; course_tag: string[] }) => {
    try {
      const newId = await createDeck({ title, description, tags, course_tag })
      router.push(`/flashcards/decks/${newId}`)
    } catch (err) {
      console.error('Failed to create deck:', err)
    }
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

      <DeckForm mode="create" isAdmin={isAdmin} onSave={handleSave} />
    </div>
  )
}

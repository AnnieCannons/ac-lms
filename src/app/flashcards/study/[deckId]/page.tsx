import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDeck, getDueCardsByDeck } from '@/lib/flashcards/queries'
import StudyPageClient from '@/components/flashcards/StudyPageClient'
import Link from 'next/link'

export default async function StudyPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [deck, cards] = await Promise.all([
    getDeck(deckId, user.id),
    getDueCardsByDeck(deckId, user.id),
  ])

  if (!deck || cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-muted-text text-sm mb-4">No cards due for this deck.</p>
        <Link href="/flashcards" className="text-sm text-teal-primary hover:underline">← Back to My Decks</Link>
      </div>
    )
  }

  return <StudyPageClient deck={deck} initialCards={cards} />
}

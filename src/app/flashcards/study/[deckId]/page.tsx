import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDeck, getDueCardsByDeck, getCardsByDeck } from '@/lib/flashcards/queries'
import StudyPageClient from '@/components/flashcards/StudyPageClient'
import Link from 'next/link'

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { deckId } = await params
  const { mode } = await searchParams
  const freeStudy = mode === 'free'

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [deck, cards] = await Promise.all([
    getDeck(deckId, user.id),
    freeStudy ? getCardsByDeck(deckId) : getDueCardsByDeck(deckId, user.id),
  ])

  if (!deck || cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <p className="text-muted-text text-sm mb-4">
          {freeStudy ? 'This deck has no cards yet.' : 'Nothing to study in this deck right now.'}
        </p>
        <Link href="/flashcards" className="text-sm text-teal-primary hover:underline">← Back to My Decks</Link>
      </div>
    )
  }

  return <StudyPageClient deck={deck} initialCards={cards} freeStudy={freeStudy} />
}

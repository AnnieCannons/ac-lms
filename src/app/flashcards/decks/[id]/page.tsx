import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getDeck, getCardsByDeck } from '@/lib/flashcards/queries'
import DeckPageClient from '@/components/flashcards/DeckPageClient'

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: deckId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [deck, cards] = await Promise.all([
    getDeck(deckId, user.id),
    getCardsByDeck(deckId),
  ])

  if (!deck) notFound()

  return <DeckPageClient deckId={deckId} deck={deck} initialCards={cards} />
}

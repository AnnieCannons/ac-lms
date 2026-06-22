import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getDeck, getCard } from '@/lib/flashcards/queries'
import EditCardClient from '@/components/flashcards/EditCardClient'

export default async function EditCardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id: deckId, cardId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [deck, card] = await Promise.all([
    getDeck(deckId, user.id),
    getCard(cardId),
  ])

  if (!card) notFound()

  return (
    <EditCardClient
      deckId={deckId}
      deckTitle={deck?.title ?? null}
      card={card}
    />
  )
}

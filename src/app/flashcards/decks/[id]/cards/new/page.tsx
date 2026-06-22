import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDeck } from '@/lib/flashcards/queries'
import NewCardClient from '@/components/flashcards/NewCardClient'

export default async function NewCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: deckId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const deck = await getDeck(deckId, user.id)

  return <NewCardClient deckId={deckId} deckTitle={deck?.title ?? null} />
}

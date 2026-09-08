import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getDeck } from '@/lib/flashcards/queries'
import BulkImportClient from './BulkImportClient'
import { getIsFlashcardAdmin } from '@/lib/flashcards/queries'

export default async function BulkImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: deckId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsFlashcardAdmin(user.id)
  if (!isAdmin) redirect('/flashcards')

  const deck = await getDeck(deckId, user.id)
  if (!deck) notFound()

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <BulkImportClient deckId={deckId} deckTitle={deck.title} />
    </div>
  )
}

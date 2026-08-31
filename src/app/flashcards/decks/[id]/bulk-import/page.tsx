import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getDeck } from '@/lib/flashcards/queries'
import BulkImportClient from './BulkImportClient'

const ADMIN_ROLES = ['instructor', 'staff', 'admin']

export default async function BulkImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: deckId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !ADMIN_ROLES.includes(profile.role ?? '')) redirect('/flashcards')

  const deck = await getDeck(deckId, user.id)
  if (!deck) notFound()

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <BulkImportClient deckId={deckId} deckTitle={deck.title} />
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllImportActivity } from '@/lib/flashcards/admin-queries'
import { getIsFlashcardAdmin } from '@/lib/flashcards/queries'
import ImportActivityPageClient from './ImportActivityPageClient'

export default async function ImportActivityPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsFlashcardAdmin(user.id)
  if (!isAdmin) redirect('/flashcards')

  const decks = await getAllImportActivity(user.id)

  return <ImportActivityPageClient decks={decks} />
}

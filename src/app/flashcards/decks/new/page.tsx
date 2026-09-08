import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewDeckClient from './NewDeckClient'
import { getIsFlashcardAdmin } from '@/lib/flashcards/queries'

export default async function NewDeckPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsFlashcardAdmin(user.id)

  return <NewDeckClient isAdmin={isAdmin} />
}

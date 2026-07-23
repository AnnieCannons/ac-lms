import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAllImportActivity } from '@/lib/flashcards/admin-queries'
import ImportActivityPageClient from './ImportActivityPageClient'

export default async function ImportActivityPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = ['instructor', 'staff', 'admin'].includes(profile?.role ?? '')
  if (!isAdmin) redirect('/flashcards')

  const decks = await getAllImportActivity(user.id)

  return <ImportActivityPageClient decks={decks} />
}

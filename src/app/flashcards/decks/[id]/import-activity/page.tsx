import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getDeck } from '@/lib/flashcards/queries'
import { getImportActivity } from '@/lib/flashcards/admin-queries'
import ImportActivityClient from './ImportActivityClient'

const ADMIN_ROLES = ['instructor', 'staff', 'admin']

export default async function ImportActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: deckId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!profile || !ADMIN_ROLES.includes(profile.role ?? '')) redirect('/flashcards')

  const deck = await getDeck(deckId, user.id)
  if (!deck) notFound()

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .eq('archived', false)
    .order('name', { ascending: true })

  const activity = await getImportActivity(deckId)

  return (
    <ImportActivityClient
      deckId={deckId}
      deckTitle={deck.title}
      lastPushDate={activity.lastPushDate}
      totalCount={activity.totalCount}
      importers={activity.importers}
      courses={courses ?? []}
    />
  )
}

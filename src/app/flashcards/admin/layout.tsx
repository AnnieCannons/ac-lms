import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getIsFlashcardAdmin } from '@/lib/flashcards/queries'

export default async function FlashcardAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsFlashcardAdmin(user.id)
  if (!isAdmin) {
    redirect('/flashcards')
  }

  return <>{children}</>

}

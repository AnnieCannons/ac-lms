import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isFlashcardAdmin } from '@/lib/flashcards/schema'

export default async function FlashcardAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !isFlashcardAdmin(profile.role)) {
    redirect('/flashcards')
  }

  return <>{children}</>

}

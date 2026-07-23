import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'AC LMS - Flashcards',
}
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import FlashcardAdminNav from '@/components/flashcards/FlashcardAdminNav'
import FlashcardAdminTabs from '@/components/flashcards/FlashcardAdminTabs'

const ADMIN_ROLES = ['instructor', 'staff', 'admin']

export default async function FlashcardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? '')

  return (
    <div className="min-h-screen bg-background">
      {isAdmin
        ? <FlashcardAdminNav name={profile?.name} role={profile?.role} />
        : <StudentTopNav name={profile?.name} role={profile?.role} />
      }
      {isAdmin && <FlashcardAdminTabs />}
      <main id="main-content" tabIndex={-1} className="focus:outline-none flashcard-content">
        {children}
      </main>
    </div>
  )
}

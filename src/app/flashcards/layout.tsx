import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import FlashcardBreadcrumb from '@/components/flashcards/FlashcardBreadcrumb'

export default async function FlashcardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      <Suspense fallback={null}>
        <FlashcardBreadcrumb />
      </Suspense>
      <main id="main-content" tabIndex={-1} className="focus:outline-none flashcard-content">
        {children}
      </main>
    </div>
  )
}

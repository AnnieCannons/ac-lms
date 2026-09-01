import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDecksWithCounts, getActivityLog } from '@/lib/flashcards/queries'
import DeckCard from '@/components/flashcards/DeckCard'
import ActivityGrid from '@/components/flashcards/ActivityGrid'
import Link from 'next/link'
import MyDecksHeader from '@/components/flashcards/MyDecksHeader'

export default async function FlashcardsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = ['instructor', 'staff', 'admin'].includes(profile?.role ?? '')

  const [decks, activityLog] = await Promise.all([
    getDecksWithCounts(user.id),
    isAdmin ? Promise.resolve([]) : getActivityLog(user.id),
  ])

  const cardsDueToday = decks.reduce(
    (sum, d) => sum + d.new_count + d.in_progress_count + d.review_count,
    0
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <Suspense fallback={null}>
        <MyDecksHeader deckCount={decks.length} cardsDueToday={cardsDueToday} />
      </Suspense>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {decks.map(deck => (
          <DeckCard key={deck.id} deck={deck} isAdmin={isAdmin} />
        ))}

        <Link
          href="/flashcards/decks/new"
          className="border border-dashed border-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 min-h-[180px] text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors"
          aria-label="Create a new deck"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span className="text-sm">New deck</span>
        </Link>
      </div>

      {!isAdmin && <ActivityGrid activityLog={activityLog} />}

    </div>
  )
}

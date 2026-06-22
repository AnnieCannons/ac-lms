import { Suspense } from 'react'
import FlashcardHeader from '@/components/flashcards/FlashcardHeader'

export default function FlashcardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="h-[52px] bg-surface border-b border-border" />}>
        <FlashcardHeader />
      </Suspense>
      <main id="main-content" tabIndex={-1} className="focus:outline-none flashcard-content">
        {children}
      </main>
    </div>
  )
}

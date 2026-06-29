'use client'
import { usePathname } from 'next/navigation'

export default function FlashcardAdminTabs() {
  const pathname = usePathname()
  const onAdmin = pathname.startsWith('/flashcards/admin')

  const active = 'px-4 py-2 text-sm font-medium text-teal-primary border-b-2 border-teal-primary -mb-px'
  const inactive = 'px-4 py-2 text-sm font-medium text-muted-text hover:text-dark-text transition-colors'

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6">
      <div className="flex gap-1 border-b border-border">
        <a href="/flashcards/admin" className={onAdmin ? active : inactive}>Admin</a>
        <a href="/flashcards" className={onAdmin ? inactive : active}>My Decks</a>
      </div>
    </div>
  )
}

'use client'
import { useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function FlashcardHeader() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const from = searchParams.get('from')

  const tabs = [
    { label: 'My Decks', href: '/flashcards' },
    { label: 'Discover', href: '/flashcards/discover' },
  ]

  const tabHref = (href: string) =>
    from ? `${href}?from=${encodeURIComponent(from)}` : href

  return (
    <div className="bg-surface border-b border-border">
      {from && (
        <div className="px-6 pt-3">
          <Link
            href={from}
            className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit"
          >
            ← Back to Course
          </Link>
        </div>
      )}
      <nav aria-label="Flashcard navigation" className="flex px-6">
        {tabs.map(tab => {
          const isActive =
            tab.href === '/flashcards'
              ? pathname === '/flashcards'
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.href)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'text-teal-primary border-teal-primary'
                  : 'text-muted-text border-transparent hover:text-dark-text'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

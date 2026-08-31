'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { importDeck } from '@/lib/flashcards/actions'

type Props = {
  deckId: string
  deckTitle: string
  alreadyImported: boolean
}

export default function ImportButton({ deckId, deckTitle, alreadyImported }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [showOverride, setShowOverride] = useState(alreadyImported)

  const handleImport = async () => {
    setState('loading')
    try {
      await importDeck(deckId)
      setState('done')
    } catch (err) {
      console.error('Failed to import deck:', err)
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-dark-text">
          <span className="font-semibold">{deckTitle}</span> has been added to your decks!
        </p>
        <button
          onClick={() => router.push('/flashcards')}
          className="bg-teal-primary text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
        >
          Go to My Decks →
        </button>
      </div>
    )
  }

  if (showOverride) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-dark-text">You&apos;ve already imported this deck.</p>
          <p className="text-xs text-muted-text mt-1">Do you want to override your copy with the latest version, or keep the one you have?</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={state === 'loading'}
            className="bg-teal-primary text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {state === 'loading' ? 'Updating…' : 'Override with latest'}
          </button>
          <Link
            href="/flashcards"
            className="text-sm text-muted-text hover:text-dark-text transition-colors px-5 py-2"
          >
            Keep mine
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleImport}
        disabled={state === 'loading'}
        className="bg-teal-primary text-white text-sm font-medium px-8 py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {state === 'loading' ? 'Importing…' : 'Import to My Decks'}
      </button>
      <Link href="/flashcards" className="text-xs text-muted-text hover:text-dark-text transition-colors">
        ← Back to My Decks
      </Link>
    </div>
  )
}

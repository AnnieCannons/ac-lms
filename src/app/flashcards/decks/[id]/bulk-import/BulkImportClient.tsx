'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { bulkImportCards } from '@/lib/flashcards/actions'

type Props = {
  deckId: string
  deckTitle: string
}

const RULES = [
  { heading: 'First line = front', body: 'The first line of each section becomes the front of the card. If you want an image on the front, keep your question text on the same line as the image.' },
  { heading: 'Everything below = back', body: 'All content after the first line becomes the back. It can include bullet points, code blocks, bold text, images, and more.' },
  { heading: 'Blank line = new card', body: 'Press Enter twice (blank line) to separate one card from the next.' },
  { heading: 'All cards start as Basic', body: 'You can change the card type to Type In or others on the deck page after importing.' },
]

export default function BulkImportClient({ deckId, deckTitle }: Props) {
  const router = useRouter()
  const [html, setHtml] = useState('')
  const [rulesOpen, setRulesOpen] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!html.trim()) return
    setImporting(true)
    setError(null)
    try {
      await bulkImportCards(deckId, html)
      router.push(`/flashcards/decks/${deckId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setImporting(false)
    }
  }

  return (
    <>
      <Link href={`/flashcards/decks/${deckId}`} className="text-sm text-muted-text hover:text-dark-text flex items-center gap-1 w-fit mb-6">
        ← Back to {deckTitle}
      </Link>

      <h1 className="text-2xl font-bold text-dark-text mb-2">Bulk Import</h1>
      <p className="text-sm text-muted-text mb-6">
        Paste a batch of notes to create multiple Basic cards at once. Follow the format rules below — you can change card types individually on the deck page after importing.
      </p>

      {/* Rules drawer */}
      <div className="mb-6 rounded-xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setRulesOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-dark-text hover:bg-background transition-colors"
          aria-expanded={rulesOpen}
        >
          <span>Format rules</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform ${rulesOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {rulesOpen && (
          <div className="px-5 pb-5 flex flex-col gap-4 border-t border-border pt-4">
            <ul className="flex flex-col gap-3">
              {RULES.map(rule => (
                <li key={rule.heading} className="flex gap-2">
                  <span className="text-muted-text mt-0.5 shrink-0">•</span>
                  <span className="text-sm text-dark-text">
                    <strong>{rule.heading}:</strong> {rule.body}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-widest">Example</p>
              <div className="bg-background rounded-lg p-4 font-mono text-xs text-dark-text leading-relaxed whitespace-pre-wrap">
                <p>What is a variable?</p>
                <p>A container that stores a value under a name.</p>
                <p>&nbsp;</p>
                <p>Name three CSS box model properties.</p>
                <p>• margin</p>
                <p>• padding</p>
                <p>• border</p>
                <p>&nbsp;</p>
                <p>What does the following code do?</p>
                <pre className="bg-border/30 rounded px-3 py-2 my-1 text-xs overflow-x-auto"><code>console.log("hello world")</code></pre>
                <p>Prints "hello world" to the console.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="mb-4">
        <RichTextEditor
          content={html}
          onChange={setHtml}
          placeholder="Paste your notes here…"
          minHeight={320}
          storagePath={`flashcard-images/${deckId}/`}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500 mb-4">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={importing || !html.trim()}
          className="bg-teal-primary text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? 'Importing…' : 'Import Cards'}
        </button>
        <Link href={`/flashcards/decks/${deckId}`} className="text-sm text-muted-text hover:text-dark-text transition-colors">
          Cancel
        </Link>
      </div>
    </>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  onClose: () => void
}

export default function ImportDeckModal({ onClose }: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const extractToken = (value: string): string | null => {
    const trimmed = value.trim()
    // Accept full URL like https://…/flashcards/share/TOKEN or just the token
    const match = trimmed.match(/\/flashcards\/share\/([^/?#\s]+)/)
    if (match) return match[1]
    // Plain token (no slashes)
    if (trimmed && !trimmed.includes('/')) return trimmed
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const token = extractToken(input)
    if (!token) {
      setError('Please paste a valid share link.')
      return
    }
    router.push(`/flashcards/share/${token}`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark-text">Import a Deck</h2>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-dark-text transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p className="text-sm text-muted-text">Paste a share link from a classmate or instructor to import their deck as your own editable copy.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            placeholder="https://…/flashcards/share/…"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
            autoFocus
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!input.trim()}
              className="bg-teal-primary text-white text-sm font-medium px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview Deck
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

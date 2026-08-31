'use client'
import { useState } from 'react'
import { enableSharing } from '@/lib/flashcards/actions'

type Props = {
  deckId: string
  shareToken: string | null
  deckTitle: string
}

export default function ShareButton({ deckId, shareToken: initialToken, deckTitle }: Props) {
  const [token, setToken] = useState(initialToken)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    let t = token
    if (!t) {
      setLoading(true)
      try {
        t = await enableSharing(deckId)
        setToken(t)
      } catch (err) {
        console.error('Failed to enable sharing:', err)
        setLoading(false)
        return
      }
      setLoading(false)
    }
    await copyToClipboard(`${window.location.origin}/flashcards/share/${t}`)
  }

  return (
    <div className="relative group/share">
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`${token ? 'Copy share link for' : 'Share'} ${deckTitle}`}
        className="w-7 h-7 flex items-center justify-center border border-border rounded-lg text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors disabled:opacity-50"
      >
        {loading ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        )}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover/share:opacity-100 transition-opacity">
        {copied ? 'Copied!' : token ? 'Copy share link' : 'Share deck'}
      </span>
    </div>
  )
}

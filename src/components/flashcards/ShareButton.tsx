'use client'
import { useState } from 'react'

type Props = {
  shareToken: string
  deckTitle: string
}

export default function ShareButton({ shareToken, deckTitle }: Props) {
  const [copied, setCopied] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/flashcards/share/${shareToken}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback for when document isn't focused
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

  return (
    <div className="relative group/share">
      <button
        onClick={handleShare}
        className="w-7 h-7 flex items-center justify-center border border-border rounded-lg text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors"
        aria-label={`Copy share link for ${deckTitle}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover/share:opacity-100 transition-opacity">
        {copied ? 'Copied!' : 'Share'}
      </span>
    </div>
  )
}

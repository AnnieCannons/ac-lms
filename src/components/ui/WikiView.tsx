'use client'

import { useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'

interface Props {
  wiki: { id: string; title: string; content: string }
  defaultOpen?: boolean
}

export default function WikiView({ wiki, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const sanitized = DOMPurify.sanitize(wiki.content)

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-border/10 transition-colors text-left"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-muted-text shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="font-semibold text-dark-text flex-1">{wiki.title || 'Untitled Wiki'}</span>
      </button>

      {open && sanitized && (
        <div
          className="prose prose-sm dark:prose-invert max-w-none px-4 pb-4 text-dark-text border-t border-border pt-3"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}

      {open && !sanitized && (
        <p className="text-sm text-muted-text italic px-4 pb-4 border-t border-border pt-3">
          No content yet.
        </p>
      )}
    </div>
  )
}
